/** AI-помічник байєра: моніторинг, креативи, ідеї, автоправила, апеляції, оплата, «Спросить» */
import { useEffect, useMemo, useRef, useState } from "react";

import { CopyButton, ErrorAlert, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { LANG, t, tt } from "../../lib/i18n";
import { ink } from "../../lib/theme";
import {
  ACTION_LABELS,
  IDEA_TAG_COLORS,
  METRIC_LABELS,
  RULE_TAG_COLORS,
  TAG_LABELS,
  UNIT_LABELS,
  decisionsOf,
  diagnose,
  healthColor,
  ideaBank,
  ruleAction,
  ruleCondition,
  scoreCreative,
} from "./adsModel";
import { Empty, Ring, Switch } from "./parts";
import { PLATFORM, fmtMoney, fmtNum, fmtPct } from "./data";

const SEV = { high: { color: "#ff7d7d", label: t("Критично") }, mid: { color: "#f0a83e", label: t("Важно") }, low: { color: "#6fa8ff", label: t("Следить") } };

const ICONS = {
  card: "M2 7h20M3 7v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7M2 11h20",
  shield: "M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6z",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  budget: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  rule: "M4 6h16M4 12h10M4 18h6",
};
const Svg = ({ d }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Текст сигналу з сервера → картка */
function alertView(a, cab) {
  const cur = a.currency || "USD";
  switch (a.kind) {
    case "payment":
      return { icon: ICONS.card, title: t("Нужна оплата"), desc: t("Показ остановлен. Пополните баланс, чтобы не терять аукционный импульс."), trend: t("Простой копит потери охвата"), impact: cab?.budget ? tt("Риск: {0} недополученного расхода/день", fmtMoney(cab.budget, cur, 0)) : t("Показы стоят"), action: "billing", actionLabel: t("Пополнить"), primary: true };
    case "ban":
      return { icon: ICONS.shield, title: t("Кабинет отключён"), desc: t("Аккаунт заблокирован платформой. Подготовьте апелляцию."), trend: t("Реклама не крутится"), impact: t("Нужна апелляция"), action: "appeals", actionLabel: t("Апелляция") };
    case "review":
      return { icon: ICONS.shield, title: t("Кабинет на модерации"), desc: t("Не меняйте бюджет и креативы до конца проверки. Готовьте черновик апелляции."), trend: t("Ожидание решения платформы"), impact: cab?.budget ? tt("Заморожено {0}/день бюджета", fmtMoney(cab.budget, cur, 0)) : t("Показы ограничены"), action: "appeals", actionLabel: t("Апелляция") };
    case "cpa":
      return { icon: ICONS.target, title: t("Дорогой лид"), desc: tt("CPA {0} выше медианы {1} — сузьте аудиторию и обновите оффер.", fmtMoney(a.cpa, cur, 1), fmtMoney(a.median, cur, 1)), trend: a.cpaTrend !== null && a.cpaTrend !== undefined ? tt("CPA {0}% к прошлому периоду", `${a.cpaTrend > 0 ? "+" : ""}${Math.round(a.cpaTrend)}`) : "—", impact: t("Переплата за лида"), action: "advice", actionLabel: t("AI-советы") };
    case "budget":
      return { icon: ICONS.budget, title: t("Бюджет почти исчерпан"), desc: tt("Освоено {0}% дневного бюджета — пополните или поднимите лимит, чтобы не было простоя.", Math.round(a.used)), trend: t("Сегодня"), impact: t("Возможен простой до конца дня"), action: "billing", actionLabel: t("Оплата") };
    case "ctr":
      return { icon: ICONS.alert, title: t("Низкий CTR"), desc: tt("CTR {0}% — креатив не цепляет. Обновите первый кадр или оффер.", a.ctr), trend: a.ctrTrend !== null && a.ctrTrend !== undefined ? tt("CTR {0}% к прошлому периоду", `${a.ctrTrend > 0 ? "+" : ""}${Math.round(a.ctrTrend)}`) : "—", impact: t("Дорогой клик и показ"), action: "creatives", actionLabel: t("Креативы") };
    case "rule":
      return { icon: ICONS.rule, title: tt("Правило «{0}»", a.rule), desc: tt("{0} = {1} — рекомендация: {2}{3}.", METRIC_LABELS[a.metric] || a.metric, fmtNum(a.value, 2), (ACTION_LABELS[a.actionType] || a.actionType).toLowerCase(), a.amount ? ` ${a.amount}%` : ""), trend: t("за последние сутки"), impact: t("Действие выполняется в кабинете вручную"), action: "rules", actionLabel: t("Правила") };
    default:
      return { icon: ICONS.alert, title: a.kind, desc: "", trend: "", impact: "", action: null, actionLabel: "" };
  }
}

export default function AiHelper({ snap, cabs, median, days, canManage, onReload, setPatch }) {
  const [tab, setTab] = useState("monitor");
  const [scope, setScope] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [advice, setAdvice] = useState(null); // { cab, text, loading, error }
  const [error, setError] = useState("");

  const scoped = scope === "all" ? cabs : cabs.filter((c) => c.id === scope);
  const cabById = Object.fromEntries(cabs.map((c) => [c.id, c]));
  const alerts = snap.signals.alerts.filter((a) => scope === "all" || a.cabinetId === scope);
  const diag = diagnose(scoped, median, days);
  const settings = snap.settings;

  // креативи (Meta) з оцінкою
  const creatives = useMemo(
    () =>
      scoped
        .flatMap((c) => (c.meta?.ads || []).map((ad) => ({ ...ad, cab: c, ...scoreCreative(ad, median || 12) })))
        .filter((a) => a.impressions > 0)
        .sort((a, b) => b.score - a.score),
    [scoped, median],
  );
  const decisions = decisionsOf(scoped, median);
  const appeals = scoped.filter((c) => c.status === "review" || c.status === "disabled");
  const billing = scoped.filter((c) => c.status === "payment" || (c.status === "active" && c.budget && c.summary.today.spend >= c.budget * 0.9));
  const rules = snap.rules;

  const openAdvice = async (cab) => {
    setAdvice({ cab, loading: true, text: "", error: "" });
    try {
      const { advice: text } = await api("/analytics/ai/cabinet", { method: "POST", body: { cabinetId: cab.id, lang: LANG } });
      setAdvice({ cab, loading: false, text, error: "" });
    } catch (e) {
      setAdvice({ cab, loading: false, text: "", error: e.message });
    }
  };

  const onAlertAction = (a) => {
    const view = alertView(a, cabById[a.cabinetId]);
    if (view.action === "advice") openAdvice(cabById[a.cabinetId]);
    else if (view.action) setTab(view.action);
  };

  const saveSettings = async (patch) => {
    setError("");
    try {
      const { settings: next } = await api("/analytics/settings", { method: "PATCH", body: patch });
      setPatch({ settings: next });
    } catch (e) {
      setError(e.message);
    }
  };

  const tabs = [
    { key: "monitor", label: t("Мониторинг"), badge: alerts.length },
    { key: "creatives", label: t("Креативы"), badge: creatives.filter((c) => c.score < 48).length },
    { key: "ideas", label: t("Идеи и решения"), badge: decisions.length },
    { key: "rules", label: t("Автоправила"), badge: rules.filter((r) => r.on).length },
    { key: "appeals", label: t("Апелляции"), badge: appeals.filter((c) => !c.appeal?.submittedAt).length },
    { key: "billing", label: t("Оплата"), badge: billing.filter((c) => !c.toppedUpRecently).length },
    { key: "ask", label: t("Спросить"), badge: 0 },
  ];

  return (
    <section className="an-ai">
      <div className="an-ai__head">
        <div className="an-ai__logo">✦</div>
        <div className="an-ai__title">
          <div>
            <b>{t("AI-помощник байера")}</b>
            <span className={`an-pill ${snap.ai ? "is-ok" : "is-off"}`}>
              <i />
              {snap.ai ? (settings.autopilot ? t("Активен") : t("Пауза")) : t("AI не подключён")}
            </span>
          </div>
          <small>{tt("Следит за {0} · {1} активных сигналов", scope === "all" ? t("всеми кабинетами") : `«${cabById[scope]?.name}»`, alerts.length)}</small>
        </div>
        <label className="an-ai__auto">
          <span>{t("Автопилот")}</span>
          <Switch on={settings.autopilot} disabled={!canManage} label={t("Автопилот")} color="#5ac878" onChange={(v) => saveSettings({ autopilot: v })} />
        </label>
        {canManage ? (
          <button type="button" className={`an-ai__gear ${settingsOpen ? "is-open" : ""}`} title={t("Настройки помощника и алертов")} aria-label={t("Настройки помощника и алертов")} onClick={() => setSettingsOpen((v) => !v)}>
            ⚙
          </button>
        ) : (
          <span className="an-ai__lock" title={t("Настройки доступны админу и PM")}>
            🔒
          </span>
        )}
      </div>

      <div className="an-ai__bar">
        <span>{t("Кабинет:")}</span>
        <div className="an-chips">
          <button type="button" className={scope === "all" ? "is-active" : ""} onClick={() => setScope("all")}>
            ▦ {t("Все кабинеты")}
          </button>
          {cabs.map((c) => (
            <button key={c.id} type="button" className={scope === c.id ? "is-active" : ""} onClick={() => setScope(c.id)}>
              <i style={{ background: PLATFORM[c.platform]?.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {settingsOpen && canManage && <HelperSettings snap={snap} save={saveSettings} />}
      <ErrorAlert error={error} />

      <div className="an-ai__tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={tab === x.key ? "is-active" : ""} onClick={() => setTab(x.key)}>
            {x.label}
            {x.badge > 0 && <span>{x.badge}</span>}
          </button>
        ))}
      </div>

      <div className="an-ai__body">
        {tab === "monitor" && (
          <div className="an-stack an-stack--sm">
            <div className="an-diag">
              <div className="an-diag__top">
                <Ring value={diag.health} color={healthColor(diag.health)} size={68} stroke={7} sub="health" />
                <div>
                  <div className="an-diag__title">
                    <b>{t("AI-диагностика")}</b>
                    <span style={{ color: ink(healthColor(diag.health)) }}>{diag.label}</span>
                  </div>
                  <small>
                    {tt("Сводка {0} · {1} из {2} активны", scope === "all" ? t("по всем кабинетам") : t("по кабинету"), diag.active, scoped.length)}
                    {diag.pacing !== null && ` · ${tt("{0}% дневного бюджета откручено", diag.pacing)}`}
                  </small>
                </div>
              </div>
              <div className="an-diag__nums">
                <div>
                  <span>{t("Расход")}</span>
                  <b>{fmtMoney(diag.spend, diag.cur, 0)}</b>
                </div>
                <div>
                  <span>{t("Ср. CPA")}</span>
                  <b>{diag.cpa ? fmtMoney(diag.cpa, diag.cur, 1) : "—"}</b>
                </div>
                <div>
                  <span>{t("Лидов")}</span>
                  <b>{fmtNum(diag.leads)}</b>
                </div>
                <div>
                  <span>{t("Прогноз на сегодня")}</span>
                  <b className="good">~{fmtNum(diag.proj)}</b>
                </div>
              </div>
              {(diag.opp || diag.risk) && (
                <div className="an-diag__cards">
                  {diag.opp && (
                    <button type="button" className="an-diag__opp" onClick={() => setScope(diag.opp.cab.id)}>
                      <b>
                        ▲ {t("Возможность")} · {diag.opp.cab.name}
                      </b>
                      <span>{diag.opp.text}</span>
                    </button>
                  )}
                  {diag.risk && (
                    <button type="button" className="an-diag__risk" onClick={() => setScope(diag.risk.cab.id)}>
                      <b>
                        ▼ {t("Риск")} · {diag.risk.cab.name}
                      </b>
                      <span>{diag.risk.text}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            {alerts.map((a) => {
              const v = alertView(a, cabById[a.cabinetId]);
              const sev = SEV[a.sev];
              return (
                <div key={`${a.cabinetId}:${a.key}`} className="an-alert" style={{ "--sev": sev.color }}>
                  <div className="an-alert__icon">
                    <Svg d={v.icon} />
                  </div>
                  <div className="an-alert__body">
                    <div className="an-alert__title">
                      <span className="an-alert__prio">{sev.label}</span>
                      <b>{v.title}</b>
                      <span className="faint">{a.acc}</span>
                    </div>
                    <div className="an-alert__desc">{v.desc}</div>
                    <div className="an-alert__meta">
                      <span>
                        <span className="faint">{t("Тренд:")}</span> {v.trend}
                      </span>
                      <span>
                        <span className="faint">{t("Эффект:")}</span> {v.impact}
                      </span>
                    </div>
                  </div>
                  {v.action && (
                    <button type="button" className={`btn btn--sm ${v.primary ? "btn--primary" : "an-btn-violet"}`} onClick={() => onAlertAction(a)}>
                      {v.actionLabel}
                    </button>
                  )}
                </div>
              );
            })}
            {!alerts.length && <div className="an-okline">✓ {t("Все кабинеты в норме — помощник не нашёл проблем.")}</div>}
          </div>
        )}

        {tab === "creatives" && <CreativesTab creatives={creatives} scope={scope} ai={snap.ai} />}

        {tab === "ideas" && <IdeasTab decisions={decisions} scoped={scoped} creatives={creatives} scope={scope} ai={snap.ai} />}

        {tab === "rules" && <RulesTab rules={rules} options={snap.ruleOptions} canManage={canManage} ai={snap.ai} onReload={onReload} />}

        {tab === "appeals" && <AppealsTab appeals={appeals} ai={snap.ai} onReload={onReload} />}

        {tab === "billing" && <BillingTab billing={billing} onReload={onReload} />}

        {tab === "ask" && <AskTab scope={scope} ai={snap.ai} />}
      </div>

      {advice && (
        <Modal title={tt("AI-советы · {0}", advice.cab.name)} onClose={() => setAdvice(null)}>
          {advice.loading ? (
            <div className="an-thinking">
              <span className="spinner" /> {t("Помощник анализирует кабинет…")}
            </div>
          ) : (
            <>
              <ErrorAlert error={advice.error} />
              {advice.text && <div className="an-ai-text">{advice.text}</div>}
            </>
          )}
        </Modal>
      )}
    </section>
  );
}

// ---------- налаштування: Telegram-алерти, AI ----------
const EVENT_LABELS = {
  payment: [t("Требуется оплата"), t("Баланс закончился, показы остановлены"), true],
  ban: [t("Бан / блокировка кабинета"), t("Аккаунт отключён платформой"), true],
  rejection: [t("Модерация"), t("Кабинет или объявления на проверке"), true],
  cpa: [t("Дорогой лид (CPA) и автоправила"), t("Цена лида выше медианы; срабатывания правил"), false],
  budget: [t("Бюджет почти исчерпан"), t("Освоено ≥ 90% дневного бюджета"), false],
  ctr: [t("Просадка CTR"), t("CTR ниже порога за период"), false],
};

function HelperSettings({ snap, save }) {
  const tg = snap.settings.tg;
  const [chat, setChat] = useState(tg.chatId || "");
  const [test, setTest] = useState("");
  const sendTest = async () => {
    setTest("…");
    try {
      const { sent } = await api("/analytics/alerts/test", { method: "POST" });
      setTest(tt("✓ Тестовый алерт отправлен ({0})", sent));
    } catch (e) {
      setTest(`⚠ ${e.message}`);
    }
  };
  return (
    <div className="an-ai__settings">
      <div className="an-set">
        <div className="an-set__head">
          <div>
            <b>✦ {t("Модель AI")}</b>
            <small>{snap.ai ? t("Claude (Anthropic) подключён — ключ хранится на сервере.") : t("Добавьте ANTHROPIC_API_KEY в .env сервера, чтобы включить советы, идеи и апелляции.")}</small>
          </div>
          <span className={`an-pill ${snap.ai ? "is-ok" : "is-off"}`}>
            <i />
            {snap.ai ? t("Подключена") : t("Не подключена")}
          </span>
        </div>
      </div>
      <div className="an-set">
        <div className="an-set__head">
          <div>
            <b>✈️ {t("Алерты в Telegram")}</b>
            <small>{t("Помощник проверяет кабинеты каждый час и шлёт уведомление, если что-то пошло не так. Каждый сигнал — не чаще раза в сутки.")}</small>
          </div>
          <Switch on={tg.enabled} label={t("Алерты в Telegram")} color="#29a9eb" onChange={(v) => save({ tg: { enabled: v } })} />
        </div>
        {tg.enabled && (
          <>
            <div className="an-set__row">
              <label className="an-field">
                <span>{t("Чат / канал для алертов")}</span>
                <input className="input input--sm" value={chat} placeholder={t("@канал или chat id — пусто: админам и PM в личку")} onChange={(e) => setChat(e.target.value)} onBlur={() => chat !== tg.chatId && save({ tg: { chatId: chat } })} />
              </label>
              <button type="button" className="btn btn--sm" onClick={sendTest}>
                {t("Тест-сообщение")}
              </button>
            </div>
            {test && <div className={test.startsWith("✓") ? "an-okline" : "alert"}>{test}</div>}
            <div className="an-set__events">
              {Object.entries(EVENT_LABELS).map(([key, [title, desc, crit]]) => (
                <div key={key} className="an-set__event">
                  <div>
                    <b>
                      {title} {crit && <span className="an-crit">{t("крит.")}</span>}
                    </b>
                    <small>{desc}</small>
                  </div>
                  <Switch on={tg.events[key]} label={title} color="#5ac878" onChange={(v) => save({ tg: { events: { [key]: v } } })} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- креативи ----------
function CreativesTab({ creatives, scope, ai }) {
  const [aiAdvice, setAiAdvice] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const askAi = async () => {
    setBusy(true);
    setError("");
    try {
      const { advice } = await api("/analytics/ai/creatives", { method: "POST", body: { cabinetId: scope === "all" ? null : scope, lang: LANG } });
      setAiAdvice(advice || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!creatives.length) return <Empty>{t("Креативы появятся для кабинетов Meta, подключённых через API: показы, клики, CTR и цена результата по каждому объявлению за 30 дней.")}</Empty>;
  const scale = creatives.filter((c) => c.score >= 72).length;
  const kill = creatives.filter((c) => c.score < 48).length;
  return (
    <div className="an-stack an-stack--sm">
      <div className="an-cre__summary">
        <span>{tt("Оценено {0} креативов по показам, охвату, кликам, CPM, CTR и цене за результат.", creatives.length)}</span>
        <span className="good">↑ {tt("{0} масштабировать", scale)}</span>
        <span className="bad">✕ {tt("{0} заменить", kill)}</span>
        {ai && (
          <button type="button" className="btn btn--sm an-btn-violet" disabled={busy} onClick={askAi}>
            {busy ? t("AI думает…") : t("✦ Советы AI")}
          </button>
        )}
      </div>
      <ErrorAlert error={error} />
      {creatives.map((c) => (
        <div key={`${c.cab.id}:${c.id}`} className="an-cre">
          <div className="an-cre__main">
            <div className="an-cre__thumb">{c.thumb ? <img src={c.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : c.format === "video" ? "▶" : "▣"}</div>
            <div className="an-cre__info">
              <div className="an-cre__name">
                <b>{c.name}</b>
                <span className="an-tag" style={{ "--tag": PLATFORM[c.cab.platform]?.color }}>
                  {PLATFORM[c.cab.platform]?.short}
                </span>
                <span className="faint">
                  {c.format || "—"} · {c.cab.name}
                </span>
              </div>
              <div className="an-cre__metrics">
                {[
                  [t("Показы"), fmtNum(c.impressions)],
                  [t("Охват"), fmtNum(c.reach)],
                  [t("Клики"), fmtNum(c.clicks)],
                  ["CPM", fmtMoney(c.cpm, c.cab.currency, 2)],
                  ["CTR", fmtPct(c.ctr, 2)],
                  [t("Результаты"), fmtNum(c.results)],
                  [t("Цена/рез."), c.cpr ? fmtMoney(c.cpr, c.cab.currency, 1) : "—"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <span>{l}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="an-cre__score">
              <span>✦ {t("Оценка")}</span>
              <b style={{ color: ink(c.color) }}>{c.score}</b>
              <div className="an-bar" style={{ height: 5 }}>
                <div style={{ width: `${c.score}%`, background: c.color }} />
              </div>
              <span className="an-tag" style={{ "--tag": c.color }}>
                {c.verdict}
              </span>
            </div>
          </div>
          <div className="an-cre__advice">
            <span>✦ {t("Совет:")}</span> {aiAdvice[c.name] || c.advice}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- ідеї ----------
function IdeasTab({ decisions, scoped, creatives, scope, ai }) {
  const [kind, setKind] = useState("offers");
  const [aiIdeas, setAiIdeas] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ideas = aiIdeas[kind] || ideaBank(kind, scoped, creatives);
  const gen = async () => {
    setBusy(true);
    setError("");
    try {
      const { ideas: list } = await api("/analytics/ai/ideas", { method: "POST", body: { kind, cabinetId: scope === "all" ? null : scope, lang: LANG } });
      setAiIdeas((m) => ({ ...m, [kind]: list }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="an-ideas">
      <div className="an-ideas__col">
        <div className="an-ideas__head">
          <b>{t("Модель решений")}</b>
          <span className="faint">{t("на базе данных кабинетов")}</span>
        </div>
        {decisions.slice(0, 5).map((d) => (
          <div key={d.acc + d.prio} className="an-decision">
            <span className="an-tag" style={{ "--tag": d.color }}>
              {d.prio}
            </span>
            <div>
              <b>{d.acc}</b>
              <span>{d.text}</span>
            </div>
          </div>
        ))}
        {!decisions.length && <Empty>{t("Явных решений нет — кабинеты в пределах нормы.")}</Empty>}
      </div>
      <div className="an-ideas__col">
        <div className="an-ideas__head">
          <b>{t("Идеи")}</b>
          <div className="an-seg an-seg--violet">
            {[
              ["offers", t("Офферы")],
              ["texts", t("Тексты")],
              ["creatives", t("Креативы")],
            ].map(([k, l]) => (
              <button key={k} type="button" className={kind === k ? "is-active" : ""} onClick={() => setKind(k)}>
                {l}
              </button>
            ))}
          </div>
          {ai && (
            <button type="button" className="an-link an-link--violet" disabled={busy} onClick={gen}>
              {busy ? t("AI придумывает…") : t("✦ Сгенерировать ещё")}
            </button>
          )}
        </div>
        <ErrorAlert error={error} />
        {aiIdeas[kind] && <div className="an-ai-note">✦ {t("Свежие идеи от AI на базе ваших данных")}</div>}
        <div className="an-ideas__grid">
          {ideas.map((i) => (
            <div key={i.t} className="an-idea">
              <div>
                <b>{i.t}</b>
                <span className="an-tag" style={{ "--tag": IDEA_TAG_COLORS[i.tag] || "#c69bff" }}>
                  {TAG_LABELS[i.tag] || i.tag}
                </span>
              </div>
              <p>
                <span className="faint">{t("Почему:")}</span> {i.why}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- автоправила ----------
function RulesTab({ rules, options, canManage, ai, onReload }) {
  const [edit, setEdit] = useState(null); // null | {} | rule
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const call = async (fn) => {
    setError("");
    try {
      await fn();
      onReload();
    } catch (e) {
      setError(e.message);
    }
  };
  const suggest = () =>
    call(async () => {
      setBusy(true);
      try {
        await api("/analytics/ai/rule", { method: "POST", body: { lang: LANG } });
      } finally {
        setBusy(false);
      }
    });
  return (
    <div className="an-stack an-stack--sm">
      <div className="an-rules__intro">
        <p>{t("Правила проверяются по всем активным кабинетам каждый час. Сработавшее правило появляется в «Мониторинге» и уходит в Telegram — менять бюджет или ставить на паузу нужно в кабинете (доступ помощника — только чтение).")}</p>
        {canManage && (
          <div>
            <button type="button" className="btn btn--sm an-btn-violet" onClick={() => setEdit({})}>
              {t("+ Создать правило")}
            </button>
            {ai && (
              <button type="button" className="btn btn--sm" disabled={busy} onClick={suggest}>
                {busy ? t("AI думает…") : t("✦ Предложить правило")}
              </button>
            )}
          </div>
        )}
      </div>
      <ErrorAlert error={error} />
      {rules.map((r) => (
        <div key={r.id} className={`an-rule ${r.on ? "" : "is-off"}`}>
          <div className="an-rule__main">
            <div className="an-rule__name">
              <b>{r.name}</b>
              <span className="an-tag" style={{ "--tag": RULE_TAG_COLORS[r.tag] || "#c69bff" }}>
                {TAG_LABELS[r.tag] || r.tag}
              </span>
              {r.isAi && <span className="an-tag" style={{ "--tag": "#c69bff" }}>✦ AI</span>}
            </div>
            <div className="an-rule__cond">
              <span className="faint">{t("Если")}</span>
              <code>{ruleCondition(r)}</code>
              <span className="faint">→</span>
              <span>{ruleAction(r)}</span>
            </div>
          </div>
          <Switch on={r.on} disabled={!canManage} label={r.name} color="#7B68EE" onChange={(v) => call(() => api(`/analytics/rules/${r.id}`, { method: "PATCH", body: { on: v } }))} />
          {canManage && (
            <>
              <button type="button" className="icon-btn" title={t("Изменить")} aria-label={t("Изменить")} onClick={() => setEdit(r)}>
                ✎
              </button>
              <button
                type="button"
                className="icon-btn"
                title={t("Удалить")}
                aria-label={t("Удалить")}
                onClick={() => window.confirm(tt("Удалить правило «{0}»?", r.name)) && call(() => api(`/analytics/rules/${r.id}`, { method: "DELETE" }))}
              >
                ✕
              </button>
            </>
          )}
        </div>
      ))}
      {!rules.length && <Empty>{t("Правил пока нет.")}</Empty>}
      {edit && <RuleModal rule={edit} options={options} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onReload(); }} />}
    </div>
  );
}

function Pills({ list, value, onPick, labels = {} }) {
  return (
    <div className="an-pills">
      {list.map((x) => (
        <button key={x || "none"} type="button" className={value === x ? "is-active" : ""} onClick={() => onPick(x)}>
          {labels[x] ?? x}
        </button>
      ))}
    </div>
  );
}

function RuleModal({ rule, options, onClose, onSaved }) {
  const isNew = !rule.id;
  const [f, setF] = useState({
    name: rule.name || "",
    metric: rule.metric || "CPA",
    op: rule.op || ">",
    val: rule.val ?? "",
    unit: rule.unit ?? "$",
    window: rule.window || "",
    actionType: rule.actionType || "notify",
    amount: rule.amount || 20,
    tag: rule.tag || "защита",
  });
  const [error, setError] = useState("");
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const showAmount = ["budget_up", "budget_down", "duplicate"].includes(f.actionType);
  const save = async () => {
    setError("");
    try {
      const body = { ...f, val: f.unit === "бюджет" ? "" : f.val, amount: showAmount ? f.amount : 0 };
      if (isNew) await api("/analytics/rules", { method: "POST", body });
      else await api(`/analytics/rules/${rule.id}`, { method: "PATCH", body });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal title={isNew ? t("Новое правило") : t("Редактирование правила")} onClose={onClose}>
      <div className="an-form">
        <label className="an-field">
          <span>{t("Название")}</span>
          <input className="input" value={f.name} maxLength={80} placeholder={t("Напр. Скейл победителей")} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <div className="an-form__block">
          <div className="an-form__cap">{t("Условие · ЕСЛИ")}</div>
          <span className="an-field__label">{t("Метрика")}</span>
          <Pills list={options.metrics} value={f.metric} onPick={(metric) => set({ metric })} labels={METRIC_LABELS} />
          <div className="an-form__row">
            <div>
              <span className="an-field__label">{t("Оператор")}</span>
              <Pills list={options.ops} value={f.op} onPick={(op) => set({ op })} />
            </div>
            <label className="an-field">
              <span>{t("Значение")}</span>
              <input className="input input--sm" inputMode="decimal" value={f.unit === "бюджет" ? "" : f.val} disabled={f.unit === "бюджет"} placeholder="18" onChange={(e) => set({ val: e.target.value.replace(",", ".") })} />
            </label>
            <div>
              <span className="an-field__label">{t("Ед.")}</span>
              <Pills list={options.units} value={f.unit} onPick={(unit) => set({ unit })} labels={UNIT_LABELS} />
            </div>
          </div>
          <label className="an-field">
            <span>{t("Период / условие (необязательно)")}</span>
            <input className="input input--sm" value={f.window} maxLength={60} placeholder={t("напр. за 24 часа")} onChange={(e) => set({ window: e.target.value })} />
          </label>
        </div>
        <div className="an-form__block">
          <div className="an-form__cap">{t("Действие · ТО")}</div>
          <Pills list={options.actions} value={f.actionType} onPick={(actionType) => set({ actionType })} labels={ACTION_LABELS} />
          {showAmount && (
            <label className="an-field an-field--inline">
              <span>{f.actionType === "budget_down" ? t("Снизить на, %") : f.actionType === "duplicate" ? t("Доп. бюджет, %") : t("Поднять на, %")}</span>
              <input className="input input--sm" inputMode="numeric" value={f.amount} onChange={(e) => set({ amount: e.target.value.replace(/\D/g, "") })} />
            </label>
          )}
        </div>
        <div>
          <span className="an-field__label">{t("Категория")}</span>
          <Pills list={options.tags} value={f.tag} onPick={(tag) => set({ tag })} labels={TAG_LABELS} />
        </div>
        <ErrorAlert error={error} />
        <div className="an-form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t("Отмена")}
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            {isNew ? t("Создать правило") : t("Сохранить")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- апеляції ----------
function AppealsTab({ appeals, ai, onReload }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const gen = async (cab) => {
    setBusy(cab.id);
    setError("");
    try {
      await api("/analytics/ai/appeal", { method: "POST", body: { cabinetId: cab.id, lang: LANG } });
      onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const submit = async (cab) => {
    try {
      await api(`/analytics/ads/cabinets/${cab.id}/appeal`, { method: "POST", body: { submitted: true } });
      onReload();
    } catch (e) {
      setError(e.message);
    }
  };
  if (!appeals.length) return <div className="an-okline">✓ {t("Нет кабинетов на модерации или в бане.")}</div>;
  return (
    <div className="an-stack an-stack--sm">
      <ErrorAlert error={error} />
      {appeals.map((c) => (
        <div key={c.id} className="an-appeal">
          <div className="an-appeal__head">
            <i style={{ background: c.status === "review" ? "#6fa8ff" : "#f0a83e" }} />
            <b>{c.name}</b>
            <span className="an-tag" style={{ "--tag": c.status === "review" ? "#6fa8ff" : "#f0a83e" }}>
              {c.status === "review" ? t("На модерации") : t("Отключён")}
            </span>
            <span className="faint">
              {PLATFORM[c.platform]?.short} · {c.accountId || "—"}
            </span>
          </div>
          {c.appeal?.draft ? (
            <div className="an-appeal__draft">
              <div className="an-appeal__cap">
                ✦ {t("Черновик апелляции от AI")}
                <CopyButton value={c.appeal.draft} className="an-link" label={t("Копировать")}>
                  {t("Копировать")}
                </CopyButton>
              </div>
              {c.appeal.draft}
            </div>
          ) : (
            <p className="an-muted">{t("Черновика пока нет.")}</p>
          )}
          <div className="an-appeal__actions">
            {ai && (
              <button type="button" className="btn btn--sm an-btn-violet" disabled={busy === c.id} onClick={() => gen(c)}>
                {busy === c.id ? t("AI пишет…") : c.appeal?.draft ? t("✦ Переписать") : t("✦ Черновик от AI")}
              </button>
            )}
            {c.appeal?.submittedAt ? (
              <span className="an-okline">✓ {t("Апелляция подана · на рассмотрении")}</span>
            ) : (
              <button type="button" className="btn btn--sm btn--primary" onClick={() => submit(c)}>
                {t("Отметить: апелляция подана")}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- оплата ----------
function BillingTab({ billing, onReload }) {
  const [error, setError] = useState("");
  const done = async (cab) => {
    try {
      await api(`/analytics/ads/cabinets/${cab.id}/topup`, { method: "POST" });
      onReload();
    } catch (e) {
      setError(e.message);
    }
  };
  if (!billing.length) return <div className="an-okline">✓ {t("Все кабинеты оплачены, бюджета хватает.")}</div>;
  return (
    <div className="an-stack an-stack--sm">
      <ErrorAlert error={error} />
      {billing.map((c) => {
        const recent = c.toppedUpRecently;
        const balance = c.meta?.balance ?? null;
        return (
          <div key={c.id} className="an-bill">
            <div className="an-alert__icon" style={{ "--sev": "#ff7d7d" }}>
              <Svg d={ICONS.card} />
            </div>
            <div className="an-bill__info">
              <b>{c.name}</b>
              <span>{c.status === "payment" ? t("Показы остановлены — требуется оплата") : tt("Бюджет почти исчерпан: {0} из {1}", fmtMoney(c.summary.today.spend, c.currency, 0), fmtMoney(c.budget, c.currency, 0))}</span>
            </div>
            <div className="an-bill__bal">
              <span>{t("БАЛАНС")}</span>
              <b>{balance !== null ? fmtMoney(balance, c.currency, 0) : "—"}</b>
            </div>
            {recent ? (
              <span className="an-okline">✓ {t("Пополнено")}</span>
            ) : (
              <div className="an-bill__actions">
                <a className="btn btn--sm btn--primary" href={c.billingUrl} target="_blank" rel="noreferrer noopener">
                  {t("Пополнить ↗")}
                </a>
                <button type="button" className="btn btn--sm" onClick={() => done(c)}>
                  {t("Готово")}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- «Спросить» ----------
const HISTORY_KEY = "pika-ai-ask";

function AskTab({ scope, ai }) {
  const [log, setLog] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(log.slice(-20)));
    } catch {
      // приватний режим — історія лише в пам'яті
    }
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [log, busy]);

  const ask = async (question) => {
    const text = (question ?? q).trim();
    if (!text || busy) return;
    setQ("");
    const next = [...log, { role: "user", text }];
    setLog(next);
    setBusy(true);
    try {
      const { answer } = await api("/analytics/ai/ask", { method: "POST", body: { question: text, cabinetId: scope === "all" ? null : scope, history: log.slice(-6), lang: LANG } });
      setLog([...next, { role: "assistant", text: answer }]);
    } catch (e) {
      setLog([...next, { role: "assistant", text: `⚠ ${e.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  if (!ai) return <Empty>{t("Чтобы задавать вопросы, подключите AI: ANTHROPIC_API_KEY в .env сервера.")}</Empty>;
  const chips = [t("Какой кабинет сейчас самый эффективный?"), t("Где перерасход бюджета?"), t("Какие связки стоит масштабировать?")];
  return (
    <div className="an-ask">
      <div className="an-ask__log">
        {log.map((m, i) => (
          <div key={i} className={`an-ask__msg ${m.role === "user" ? "is-user" : ""} ${m.error ? "is-error" : ""}`}>
            <div>{m.text}</div>
          </div>
        ))}
        {busy && (
          <div className="an-thinking">
            <span className="spinner" /> {t("Помощник анализирует кабинеты…")}
          </div>
        )}
        {!log.length && !busy && (
          <div className="an-ask__chips">
            {chips.map((c) => (
              <button key={c} type="button" onClick={() => ask(c)}>
                💬 {c}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="an-ask__input">
        <input className="input" value={q} maxLength={1000} placeholder={t("Спросите помощника про кабинеты…")} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
        {log.length > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => setLog([])} title={t("Очистить диалог")}>
            ↺
          </button>
        )}
        <button type="button" className="btn an-btn-violet" disabled={busy || !q.trim()} onClick={() => ask()}>
          {t("Спросить")}
        </button>
      </div>
    </div>
  );
}
