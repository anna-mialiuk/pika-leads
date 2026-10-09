import { useEffect, useMemo, useState } from "react";

import { CopyButton, ErrorAlert, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { LANG, t, tt } from "../../lib/i18n";
import { useMeta } from "../../lib/meta";
import { useProjects } from "../../lib/projects";
import { can } from "../../lib/roles";
import { formatDate } from "../../lib/format";
import AiHelper from "./AiHelper";
import Trust from "./Trust";
import { healthOf } from "./adsModel";
import { Card, Empty, Loading } from "./parts";
import { CAB_STATUS, PLATFORM, dropCache, fmtMoney, fmtNum, fmtPct, useApi } from "./data";

const COLS_KEY = "pika-ads-cols";
const COL_DEFS = [
  ["clicks", t("Клики")],
  ["impressions", t("Показы")],
  ["ctr", "CTR"],
  ["conv", t("Конверсии")],
  ["cpa", t("Цена конв. (CPA)")],
  ["spend", t("Расход")],
  ["budget", t("Бюджет")],
];
const DEFAULT_COLS = { clicks: true, impressions: true, ctr: true, conv: true, cpa: true, spend: true, budget: true };
const DAYS = [
  [1, t("Сегодня")],
  [7, t("7 дней")],
  [14, t("14 дней")],
  [30, t("30 дней")],
  [90, t("90 дней")],
];

const readCols = () => {
  try {
    return { ...DEFAULT_COLS, ...JSON.parse(localStorage.getItem(COLS_KEY) || "{}") };
  } catch {
    return DEFAULT_COLS;
  }
};

export default function AdsTab() {
  const { user } = useAuth();
  const canManage = can(user, "manage");
  const [days, setDays] = useState(30);
  const [plat, setPlat] = useState("all");
  const [cols, setCols] = useState(readCols);
  const [colsOpen, setColsOpen] = useState(false);
  const [open, setOpen] = useState({});
  const [modal, setModal] = useState(null); // { type: 'connect'|'edit'|'share'|'advice', cab }
  const q = useApi(`/analytics/ads?days=${days}`);

  const reload = () => {
    dropCache("/analytics");
    q.reload();
  };
  const patch = (p) => q.set({ ...q.data, ...p });

  const snap = q.data;
  const median = snap?.signals?.medianCpa || 0;
  const cabs = useMemo(
    () => (snap?.cabinets || []).map((c) => ({ ...c, statusLabelT: CAB_STATUS[c.status]?.label || c.status, health: 0 })).map((c) => ({ ...c, health: healthOf(c, median) })),
    [snap, median],
  );

  if (q.loading) return <Loading />;
  if (q.error && !snap) return <div className="alert">⚠ {q.error}</div>;

  const shown = cabs.filter((c) => plat === "all" || c.platform === plat);
  const cur = shown[0]?.currency || "USD";
  const tot = shown.reduce(
    (a, c) => ({ spend: a.spend + c.summary.spend, conv: a.conv + c.summary.conv, clicks: a.clicks + c.summary.clicks }),
    { spend: 0, conv: 0, clicks: 0 },
  );
  const toggleCol = (key) => {
    const next = { ...cols, [key]: !cols[key] };
    setCols(next);
    try {
      localStorage.setItem(COLS_KEY, JSON.stringify(next));
    } catch {
      // без збереження — лише до перезавантаження
    }
  };

  return (
    <div className="an-stack">
      {cabs.length > 0 && <AiHelper snap={snap} cabs={cabs} median={median} days={days} canManage={canManage} onReload={reload} setPatch={patch} />}

      <div className="an-toolbar">
        <div className="an-seg">
          {[["all", t("Все")], ["meta", "Meta"], ["google", "Google"], ["tiktok", "TikTok"]].map(([k, l]) => (
            <button key={k} type="button" className={plat === k ? "is-active" : ""} onClick={() => setPlat(k)}>
              {l}
            </button>
          ))}
        </div>
        <select className="select select--sm an-toolbar__days" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t("Период")}>
          {DAYS.map(([d, l]) => (
            <option key={d} value={d}>
              {l}
            </option>
          ))}
        </select>
        <span className="an-toolbar__spacer" />
        <div className="an-cols-menu">
          <button type="button" className="btn btn--sm" onClick={() => setColsOpen((v) => !v)} aria-expanded={colsOpen}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M6 12h12M10 18h4" />
            </svg>
            {t("Поля")}
          </button>
          {colsOpen && (
            <div className="an-cols-menu__pop">
              <div className="an-cap">{t("Отображать колонки")}</div>
              {COL_DEFS.map(([k, l]) => (
                <label key={k}>
                  <input type="checkbox" checked={cols[k]} onChange={() => toggleCol(k)} />
                  {l}
                </label>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal({ type: "connect" })}>
          {t("+ Подключить кабинет")}
        </button>
      </div>

      {cabs.length === 0 ? (
        <Card>
          <Empty>
            <b>{t("Кабинетов пока нет")}</b>
            <br />
            {snap.metaApi
              ? t("Нажмите «Подключить кабинет»: кабинеты Meta подтянутся из API, Google Ads и TikTok — добавьте и вносите расходы вручную.")
              : t("Нажмите «Подключить кабинет» и вносите расходы вручную. Чтобы Meta Ads подтягивались автоматически — добавьте META_ADS_TOKEN в .env сервера.")}
          </Empty>
        </Card>
      ) : (
        <>
          <div className="an-kpis an-kpis--5">
            <div className="an-kpi">
              <div className="an-kpi__label">{t("Рекламных кабинетов")}</div>
              <div className="an-kpi__value">{shown.length}</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">{t("Общий расход")}</div>
              <div className="an-kpi__value">{fmtMoney(tot.spend, cur, 0)}</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">{t("Конверсий")}</div>
              <div className="an-kpi__value">{fmtNum(tot.conv)}</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">{t("Средний CPA")}</div>
              <div className="an-kpi__value">{tot.conv ? fmtMoney(tot.spend / tot.conv, cur, 1) : "—"}</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi__label">{t("Кликов")}</div>
              <div className="an-kpi__value">{fmtNum(tot.clicks)}</div>
            </div>
          </div>

          {(cabs.some((c) => c.platform === "meta") || snap.pages.length > 0) && <Trust pages={snap.pages} cabinets={cabs} ai={snap.ai} onReload={reload} />}

          <div className="an-stack an-stack--sm">
            {shown.map((c) => (
              <CabinetCard
                key={c.id}
                cab={c}
                cols={cols}
                median={median}
                open={Boolean(open[c.id])}
                toggle={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                onModal={(type) => setModal({ type, cab: c })}
                canManage={canManage}
                ai={snap.ai}
                onReload={reload}
              />
            ))}
            {!shown.length && <Empty>{t("Нет кабинетов этой платформы.")}</Empty>}
          </div>
        </>
      )}

      {modal?.type === "connect" && <CabinetModal metaApi={snap.metaApi} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
      {modal?.type === "edit" && <CabinetModal cab={modal.cab} metaApi={snap.metaApi} canManage={canManage} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
      {modal?.type === "share" && <ShareModal cab={modal.cab} onClose={() => setModal(null)} onChanged={reload} />}
      {modal?.type === "advice" && <AdviceModal cab={modal.cab} onClose={() => setModal(null)} />}
    </div>
  );
}

// ---------- картка кабінету ----------
function CabinetCard({ cab, cols, open, toggle, onModal, ai, onReload }) {
  const s = cab.summary;
  const st = CAB_STATUS[cab.status] || CAB_STATUS.active;
  const usePct = cab.budget ? (s.today.spend / cab.budget) * 100 : 0;
  return (
    <div className={`an-cab ${open ? "is-open" : ""}`}>
      <div className="an-cab__head" role="button" tabIndex={0} onClick={toggle} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())} aria-expanded={open}>
        <i className="an-cab__dot" style={{ background: PLATFORM[cab.platform]?.color }} />
        <div className="an-cab__name">
          <div>
            <b>{cab.name}</b>
            <span className="an-status" style={{ "--st": st.color }}>
              <i />
              {st.label}
            </span>
          </div>
          <small>
            {PLATFORM[cab.platform]?.label} · {cab.accountId || t("без ID")}
            {cab.source === "api" ? ` · ${t("API")}` : ` · ${t("вручную")}`}
          </small>
        </div>
        <div className="an-cab__metrics">
          {cols.conv && (
            <div>
              <span>{t("КОНВ.")}</span>
              <b>{fmtNum(s.conv)}</b>
            </div>
          )}
          {cols.cpa && (
            <div>
              <span>CPA</span>
              <b className="good">{s.cpa ? fmtMoney(s.cpa, cab.currency, 1) : "—"}</b>
            </div>
          )}
          {cols.spend && (
            <div>
              <span>{t("РАСХОД")}</span>
              <b>{fmtMoney(s.spend, cab.currency, 0)}</b>
            </div>
          )}
        </div>
        <div className="an-cab__btns" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
          {ai && (
            <button type="button" className="an-cab__btn is-ai" title={t("AI-советы")} aria-label={t("AI-советы")} onClick={() => onModal("advice")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.9 4.5L18.5 9l-4.6 1.5L12 15l-1.9-4.5L5.5 9l4.6-1.5z" />
                <path d="M19 15l.8 2 .8-2M5 18l.6 1.5" />
              </svg>
            </button>
          )}
          <button type="button" className="an-cab__btn" title={t("Ссылка для клиента")} aria-label={t("Ссылка для клиента")} onClick={() => onModal("share")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
          </button>
        </div>
        <span className="an-cab__chev">{open ? "▴" : "▾"}</span>
      </div>

      {open && (
        <div className="an-cab__body">
          {cab.status !== "active" && cab.status !== "paused" && (
            <div className="an-cab__warn">⚠ {tt("Кабинет требует внимания — «{0}». Показ рекламы приостановлен или ограничен.", st.label)}</div>
          )}
          {cab.meta?.error && <div className="alert">⚠ Meta: {cab.meta.error}</div>}
          <div className="an-cab__grid">
            {cols.clicks && (
              <div>
                <span>{t("Клики")}</span>
                <b>{fmtNum(s.clicks)}</b>
              </div>
            )}
            {cols.impressions && (
              <div>
                <span>{t("Показы")}</span>
                <b>{fmtNum(s.impressions)}</b>
              </div>
            )}
            {cols.ctr && (
              <div>
                <span>CTR</span>
                <b>{fmtPct(s.ctr, 2)}</b>
              </div>
            )}
            {cols.budget && (
              <div className="an-cab__budget">
                <span>{cab.budget ? tt("Бюджет/день · освоено сегодня {0}%", Math.round(usePct)) : t("Дневной бюджет не задан")}</span>
                <b>{cab.budget ? fmtMoney(cab.budget, cab.currency, 0) : "—"}</b>
                <div className="an-bar" style={{ height: 5 }}>
                  <div style={{ width: `${Math.min(100, usePct)}%`, background: usePct >= 90 ? "#ff7d7d" : "var(--accent)" }} />
                </div>
              </div>
            )}
          </div>

          <div className="an-cap">{t("Кампании")}</div>
          {s.campaigns.length ? (
            <div className="an-table-wrap">
              <table className="an-table an-table--compact">
                <thead>
                  <tr>
                    <th>{t("Кампания")}</th>
                    <th className="num">{t("Расход")}</th>
                    <th className="num">{t("Бюджет")}</th>
                    <th className="num">{t("Рез.")}</th>
                    <th className="num">{t("Цена рез.")}</th>
                    <th className="num">CTR</th>
                    <th>{t("Статус")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.campaigns.map((x) => (
                    <tr key={x.name}>
                      <td className="mono">{x.name}</td>
                      <td className="num">{fmtMoney(x.spend, cab.currency, 0)}</td>
                      <td className="num faint">{x.budget ? fmtMoney(x.budget, cab.currency, 0) : "—"}</td>
                      <td className="num">{fmtNum(x.conv)}</td>
                      <td className="num faint">{x.cpa ? fmtMoney(x.cpa, cab.currency, 1) : "—"}</td>
                      <td className="num faint">{fmtPct(x.ctr, 2)}</td>
                      <td className={x.status === "active" ? "good" : "faint"}>{x.status ? (x.status === "active" ? t("активна") : x.status === "paused" ? t("пауза") : x.status) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="an-muted">{cab.source === "api" ? t("Данных за период нет.") : t("Внесите расходы ниже — кампании появятся здесь.")}</p>
          )}

          {cab.source !== "api" && <StatsEditor cab={cab} onReload={onReload} />}

          <div className="an-cab__foot">
            {ai && (
              <button type="button" className="btn btn--sm an-btn-violet" onClick={() => onModal("advice")}>
                {t("✦ AI-советы по кабинету")}
              </button>
            )}
            <button type="button" className="btn btn--sm" onClick={() => onModal("share")}>
              {cab.share ? t("Ссылка для клиента") : t("Создать ссылку для клиента")}
            </button>
            {cab.source === "api" && <SyncButton cab={cab} onReload={onReload} />}
            <span className="an-toolbar__spacer" />
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => onModal("edit")}>
              {t("✎ Настройки кабинета")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SyncButton({ cab, onReload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      await api(`/analytics/ads/cabinets/${cab.id}/sync`, { method: "POST" });
      onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="an-sync">
      <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={sync}>
        {busy ? t("Обновляем…") : t("↻ Обновить из Meta")}
      </button>
      {cab.meta?.syncedAt && <small className="faint">{tt("синхронизировано {0}", formatDate(cab.meta.syncedAt))}</small>}
      {error && <small className="bad">{error}</small>}
    </span>
  );
}

// ---------- ручні дані ----------
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function StatsEditor({ cab, onReload }) {
  const [f, setF] = useState({ date: today(), campaign: cab.summary.campaigns[0]?.name === "—" ? "" : cab.summary.campaigns[0]?.name || "", spend: "", impressions: "", clicks: "", conversions: "" });
  const [error, setError] = useState("");
  const [list, setList] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api(`/analytics/ads/cabinets/${cab.id}/stats`, { method: "POST", body: f });
      setF((x) => ({ ...x, spend: "", impressions: "", clicks: "", conversions: "" }));
      setList(null);
      onReload();
    } catch (err) {
      setError(err.message);
    }
  };
  const loadList = async () => {
    try {
      const { stats } = await api(`/analytics/ads/cabinets/${cab.id}/stats`);
      setList(stats);
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async (id) => {
    try {
      await api(`/analytics/ads/cabinets/${cab.id}/stats/${id}`, { method: "DELETE" });
      setList((l) => l.filter((x) => x.id !== id));
      onReload();
    } catch (err) {
      setError(err.message);
    }
  };
  const num = (key, label) => (
    <label className="an-field">
      <span>{label}</span>
      <input className="input input--sm" inputMode="decimal" value={f[key]} onChange={(e) => set({ [key]: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })} />
    </label>
  );
  return (
    <div className="an-stats">
      <div className="an-cap">{t("Внести данные за день")}</div>
      <form className="an-stats__form" onSubmit={save}>
        <label className="an-field">
          <span>{t("Дата")}</span>
          <input type="date" className="input input--sm" value={f.date} max={today()} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="an-field an-stats__camp">
          <span>{t("Кампания (= utm_campaign)")}</span>
          <input className="input input--sm" value={f.campaign} maxLength={120} placeholder="search_medicine_ua" onChange={(e) => set({ campaign: e.target.value })} />
        </label>
        {num("spend", tt("Расход, {0}", cab.currency))}
        {num("impressions", t("Показы"))}
        {num("clicks", t("Клики"))}
        {num("conversions", t("Конверсии"))}
        <button type="submit" className="btn btn--sm btn--primary">
          {t("Добавить")}
        </button>
      </form>
      <ErrorAlert error={error} />
      {list === null ? (
        <button type="button" className="an-link" onClick={loadList}>
          {t("Показать внесённые записи")}
        </button>
      ) : (
        <div className="an-table-wrap">
          <table className="an-table an-table--compact">
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.date}</td>
                  <td className="mono">{r.campaign || "—"}</td>
                  <td className="num">{fmtMoney(r.spend, cab.currency, 2)}</td>
                  <td className="num faint">{fmtNum(r.impressions)}</td>
                  <td className="num faint">{fmtNum(r.clicks)}</td>
                  <td className="num">{fmtNum(r.conversions)}</td>
                  <td className="num">
                    <button type="button" className="icon-btn" aria-label={t("Удалить")} title={t("Удалить")} onClick={() => remove(r.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td className="faint">{t("Записей пока нет")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- підключення / налаштування кабінету ----------
function CabinetModal({ cab, metaApi, canManage, onClose, onSaved }) {
  const { users } = useMeta();
  const { projects } = useProjects();
  const isNew = !cab;
  const [f, setF] = useState({
    platform: cab?.platform || "meta",
    name: cab?.name || "",
    accountId: cab?.accountId || "",
    currency: cab?.currency || "USD",
    budget: cab?.budget || "",
    niche: cab?.niche || "",
    buyerId: cab?.buyerId || "",
    projectId: cab?.projectId || "",
    status: cab?.status || "active",
  });
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const viaApi = f.platform === "meta" && metaApi;

  const loadAccounts = async () => {
    setError("");
    try {
      const { accounts: list } = await api("/analytics/ads/meta-accounts");
      setAccounts(list);
    } catch (e) {
      setError(e.message);
      setAccounts([]);
    }
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body = { ...f, buyerId: f.buyerId || null, projectId: f.projectId || null, budget: f.budget === "" ? 0 : f.budget };
      if (isNew) await api("/analytics/ads/cabinets", { method: "POST", body });
      else {
        delete body.platform;
        if (cab.source === "api") delete body.status;
        await api(`/analytics/ads/cabinets/${cab.id}`, { method: "PATCH", body });
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(tt("Отключить кабинет «{0}»? Данные расходов перестанут учитываться.", cab.name))) return;
    try {
      await api(`/analytics/ads/cabinets/${cab.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  const buyers = users.filter((u) => u.role === "buyer" || u.position === "Байер" || u.id === f.buyerId);

  return (
    <Modal title={isNew ? t("Подключить кабинет") : t("Настройки кабинета")} onClose={onClose}>
      <div className="an-form">
        {isNew && (
          <div className="an-seg an-seg--wide">
            {["meta", "google", "tiktok"].map((p) => (
              <button key={p} type="button" className={f.platform === p ? "is-active" : ""} style={f.platform === p ? { background: PLATFORM[p].color, color: p === "tiktok" ? "#111" : "#fff" } : undefined} onClick={() => set({ platform: p })}>
                {PLATFORM[p].label}
              </button>
            ))}
          </div>
        )}
        {isNew && (
          <p className="an-muted">
            {viaApi
              ? t("Meta Ads подключён через API: статус, баланс, кампании и объявления обновляются каждый час.")
              : f.platform === "meta"
                ? t("API Meta не подключён — данные вносятся вручную. Для автоматики добавьте META_ADS_TOKEN (System User, право ads_read) в .env сервера.")
                : t("Google Ads и TikTok — расходы, клики и конверсии вносятся вручную по дням. Название кампании = utm_campaign, тогда заявки из CRM привяжутся к кабинету.")}
          </p>
        )}
        {isNew && viaApi && (
          <div className="an-accounts">
            {accounts === null ? (
              <button type="button" className="btn btn--sm" onClick={loadAccounts}>
                {t("Показать кабинеты из Meta")}
              </button>
            ) : (
              accounts.map((a) => (
                <button
                  key={a.accountId}
                  type="button"
                  disabled={a.connected}
                  className={f.accountId === a.accountId ? "is-active" : ""}
                  onClick={() => set({ accountId: a.accountId, name: a.name, currency: a.currency })}
                >
                  <b>{a.name}</b>
                  <span className="faint">
                    {a.accountId} · {a.currency}
                    {a.connected ? ` · ${t("уже подключён")}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
        <div className="an-form__row an-form__row--2">
          <label className="an-field">
            <span>{t("Название")}</span>
            <input className="input" value={f.name} maxLength={80} placeholder="PikaLeads — Clinic UA" onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="an-field">
            <span>{t("ID кабинета")}</span>
            <input className="input" value={f.accountId} maxLength={40} disabled={!isNew && cab?.source === "api"} placeholder={f.platform === "meta" ? "act_1029384756" : "419-283-9856"} onChange={(e) => set({ accountId: e.target.value })} />
          </label>
          <label className="an-field">
            <span>{t("Валюта")}</span>
            <input className="input" value={f.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
          </label>
          <label className="an-field">
            <span>{t("Дневной бюджет")}</span>
            <input className="input" inputMode="decimal" value={f.budget} placeholder={viaApi ? t("из кампаний Meta") : "150"} onChange={(e) => set({ budget: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })} />
          </label>
          <label className="an-field">
            <span>{t("Ниша")}</span>
            <input className="input" value={f.niche} maxLength={40} list="an-niches" placeholder={t("Медицина")} onChange={(e) => set({ niche: e.target.value })} />
            <datalist id="an-niches">
              {["Медицина", "iGaming", "E-commerce", "Telegram", "Финансы", "B2B"].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label className="an-field">
            <span>{t("Байер")}</span>
            <select className="select" value={f.buyerId} onChange={(e) => set({ buyerId: e.target.value ? Number(e.target.value) : "" })}>
              <option value="">{t("— не назначен —")}</option>
              {buyers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="an-field">
            <span>{t("Проект")}</span>
            <select className="select" value={f.projectId} onChange={(e) => set({ projectId: e.target.value ? Number(e.target.value) : "" })}>
              <option value="">{t("— без проекта —")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {!(viaApi || cab?.source === "api") && (
            <label className="an-field">
              <span>{t("Статус")}</span>
              <select className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}>
                {Object.entries(CAB_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <ErrorAlert error={error} />
        <div className="an-form__actions">
          {!isNew && canManage && (
            <button type="button" className="btn btn--danger btn--sm" onClick={remove}>
              {t("Отключить кабинет")}
            </button>
          )}
          <span className="an-form__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t("Отмена")}
          </button>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>
            {isNew ? t("Подключить") : t("Сохранить")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- посилання для клієнта ----------
function ShareModal({ cab, onClose, onChanged }) {
  const [share, setShare] = useState(cab.share);
  const [error, setError] = useState("");
  const url = share ? `${window.location.origin}/share/${share.token}` : "";
  const toggle = async (enable) => {
    setError("");
    try {
      const { cabinet } = await api(`/analytics/ads/cabinets/${cab.id}/share`, { method: "POST", body: { enable } });
      setShare(cabinet.share);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal title={tt("Ссылка для клиента · {0}", cab.name)} onClose={onClose}>
      <div className="an-form">
        <p className="an-muted">{t("Клиент увидит без входа в панель: расход, показы, клики, конверсии, CPA и кампании за последние 30 дней. ID кабинета, баланс и команда не показываются.")}</p>
        {share ? (
          <>
            <div className="an-share">
              <code>{url}</code>
              <CopyButton value={url} className="btn btn--sm" label={t("Копировать")}>
                {t("Копировать")}
              </CopyButton>
            </div>
            <div className="an-form__actions">
              <button type="button" className="btn btn--danger btn--sm" onClick={() => toggle(false)}>
                {t("Отключить ссылку")}
              </button>
              <button type="button" className="btn btn--sm" onClick={() => toggle(true)}>
                {t("Создать новую (старая перестанет работать)")}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => toggle(true)}>
            {t("Создать ссылку")}
          </button>
        )}
        <ErrorAlert error={error} />
      </div>
    </Modal>
  );
}

function AdviceModal({ cab, onClose }) {
  const [state, setState] = useState({ loading: true, text: "", error: "" });
  useEffect(() => {
    let alive = true;
    api("/analytics/ai/cabinet", { method: "POST", body: { cabinetId: cab.id, lang: LANG } })
      .then(({ advice }) => alive && setState({ loading: false, text: advice, error: "" }))
      .catch((e) => alive && setState({ loading: false, text: "", error: e.message }));
    return () => {
      alive = false;
    };
  }, [cab.id]);
  return (
    <Modal title={tt("AI-советы · {0}", cab.name)} onClose={onClose}>
      {state.loading ? (
        <div className="an-thinking">
          <span className="spinner" /> {t("Помощник анализирует кабинет…")}
        </div>
      ) : (
        <>
          <ErrorAlert error={state.error} />
          {state.text && <div className="an-ai-text">{state.text}</div>}
        </>
      )}
    </Modal>
  );
}
