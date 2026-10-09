import { useState } from "react";

import { CopyButton, ErrorAlert } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDate } from "../../lib/format";
import { t, tt } from "../../lib/i18n";
import { can } from "../../lib/roles";
import { BarRow, Card, Columns, Empty, Loading, Spark, Trend } from "./parts";
import { PALETTE, deltaPct, dropCache, fmtDur, fmtMoney, fmtNum, fmtPct, useApi } from "./data";

const GaLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="16" y="3" width="5" height="18" rx="2.5" fill="#F9AB00" />
    <rect x="9.5" y="9" width="5" height="12" rx="2.5" fill="#E37400" />
    <circle cx="5.5" cy="18" r="2.8" fill="#E37400" />
  </svg>
);

const CHANNELS = {
  "Organic Search": t("Органический поиск"),
  "Paid Social": t("Платные соцсети"),
  "Paid Search": t("Платный поиск"),
  Direct: t("Прямые заходы"),
  Referral: t("Переходы с сайтов"),
  "Organic Social": t("Соцсети"),
  Email: "Email",
  Unassigned: t("Без канала"),
};
const FUNNEL_EVENTS = [
  ["session_start", t("Начало сессии")],
  ["page_view", t("Просмотр страницы")],
  ["scroll", t("Прокрутка 90%")],
  ["form_start", t("Начали заполнять форму")],
  ["generate_lead", t("Отправили заявку")],
];

function Connect({ status, onChecked }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const check = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/analytics/ga4/check", { method: "POST" });
      onChecked();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="an-connect">
      <div className="an-connect__logo">
        <GaLogo size={34} />
      </div>
      <h2>{t("Подключите Google Analytics 4")}</h2>
      <p>{t("Данные о посетителях, гео, демографии, каналах, кампаниях Google Ads и событиях будут подтягиваться автоматически — через сервисный аккаунт Google, только чтение отчётов.")}</p>
      <ol className="an-steps">
        <li>{t("Google Cloud Console → создайте проект → включите «Google Analytics Data API».")}</li>
        <li>{t("IAM → Сервисные аккаунты → создайте аккаунт → Ключи → Добавить ключ → JSON. Файл скачается.")}</li>
        <li>{t("GA4 → Администратор → Управление доступом к ресурсу → добавьте email сервисного аккаунта с ролью «Читатель».")}</li>
        <li>{t("Загрузите JSON на сервер (вне репозитория) и пропишите в .env сервера:")}</li>
      </ol>
      <pre className="an-code">
        GA4_PROPERTY_ID=123456789{"\n"}GA4_SERVICE_ACCOUNT_FILE=/home/deploy/ga4-key.json
      </pre>
      {status?.error && <div className="alert">⚠ {status.error}</div>}
      {status?.email && (
        <p className="an-muted">
          {t("Сервисный аккаунт:")} <b>{status.email}</b> <CopyButton value={status.email} className="an-link" label={t("Копировать")}>{t("Копировать")}</CopyButton>
        </p>
      )}
      <ErrorAlert error={error} />
      {can(user, "manage") && (
        <button type="button" className="btn an-btn-white" disabled={busy} onClick={check}>
          {busy ? t("Проверяем…") : t("Проверить подключение")}
        </button>
      )}
      <small className="faint">{t("Ключ хранится только на сервере. Отозвать доступ — удалить аккаунт из ресурса GA4.")}</small>
    </div>
  );
}

export default function GaTab({ status }) {
  const [period, setPeriod] = useState("28d");
  const configured = Boolean(status.data?.configured);
  const q = useApi(`/analytics/ga4?period=${period}`, { enabled: configured, ttl: 10 * 60_000 });
  const rt = useApi("/analytics/ga4/realtime", { enabled: configured, ttl: 60_000 });

  if (status.loading) return <Loading />;
  if (!configured) return <Connect status={status.data} onChecked={() => { dropCache("/analytics/ga4"); status.reload(); }} />;
  if (q.loading) return <Loading />;
  if (q.error && !q.data) {
    return (
      <div className="an-stack">
        <div className="alert">⚠ {q.error}</div>
        <Connect status={status.data} onChecked={() => { dropCache("/analytics/ga4"); status.reload(); q.reload(); }} />
      </div>
    );
  }
  const d = q.data;
  const k = d.kpi;
  const p = d.kpiPrev || {};
  const kpis = [
    [t("Пользователи"), fmtNum(k.totalUsers), deltaPct(k.totalUsers, p.totalUsers)],
    [t("Новые"), fmtNum(k.newUsers), deltaPct(k.newUsers, p.newUsers)],
    [t("Сессии"), fmtNum(k.sessions), deltaPct(k.sessions, p.sessions)],
    [t("Вовлечённость"), fmtPct((k.engagementRate || 0) * 100), deltaPct(k.engagementRate, p.engagementRate)],
    [t("Ср. время сессии"), fmtDur(k.averageSessionDuration), deltaPct(k.averageSessionDuration, p.averageSessionDuration)],
    [t("Конверсии"), fmtNum(k.keyEvents), deltaPct(k.keyEvents, p.keyEvents)],
  ];
  const usersMax = Math.max(1, ...d.daily.map((x) => Math.max(x.totalUsers, x.sessions)));
  const countryTotal = d.countries.reduce((s, c) => s + c.totalUsers, 0);
  const ages = d.ages.filter((a) => a.userAgeBracket && a.userAgeBracket !== "unknown");
  const ageTotal = ages.reduce((s, a) => s + a.totalUsers, 0);
  const genders = d.genders.filter((g) => g.userGender === "male" || g.userGender === "female");
  const gTotal = genders.reduce((s, g) => s + g.totalUsers, 0);
  const male = gTotal ? Math.round(((genders.find((g) => g.userGender === "male")?.totalUsers || 0) / gTotal) * 100) : 0;
  const intTotal = d.interests.reduce((s, i) => s + i.totalUsers, 0);
  const evMap = Object.fromEntries(d.events.map((e) => [e.eventName, e]));
  const funnel = FUNNEL_EVENTS.filter(([name]) => evMap[name]).map(([name, label]) => ({ name, label, count: evMap[name].totalUsers }));
  const fTop = funnel[0]?.count || 1;

  return (
    <div className="an-stack">
      <div className="an-accbar">
        <GaLogo />
        <div>
          <b>{tt("Ресурс GA4 {0}", status.data.propertyId)}</b>
          <small>{tt("синхронизировано {0} · {1}", formatDate(d.syncedAt), status.data.email)}</small>
        </div>
        <span className="an-pill is-ok">
          <i />
          {t("Активно")}
        </span>
        <span className="an-toolbar__spacer" />
        <select className="select select--sm" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={t("Период")}>
          <option value="7d">{t("7 дней")}</option>
          <option value="28d">{t("28 дней")}</option>
          <option value="90d">{t("90 дней")}</option>
        </select>
      </div>

      <div className="an-gatop">
        <section className="an-card an-rt">
          <div className="an-cap good">● {t("В реальном времени")}</div>
          <b>{rt.data ? fmtNum(rt.data.total) : "…"}</b>
          <small>{t("пользователей за 30 мин")}</small>
          <Spark values={rt.data?.perMinute || []} color="#4fd8c8" height={46} />
        </section>
        <div className="an-kpis an-kpis--3">
          {kpis.map(([label, value, delta]) => (
            <div key={label} className="an-kpi">
              <div className="an-kpi__label">{label}</div>
              <div className="an-kpi__value an-kpi__value--sm">{value}</div>
              <div className="an-kpi__sub">
                <Trend value={delta} /> <span className="faint">{t("к прошлому периоду")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card title={t("Пользователи и сессии")} right={<div className="an-legend"><span><i style={{ background: "#FFC629" }} />{t("Пользователи")}</span><span><i style={{ background: "#6fa8ff" }} />{t("Сессии")}</span></div>}>
        <div className="an-pairs">
          {d.daily.map((x) => (
            <div key={x.date} title={`${x.date}: ${x.totalUsers} / ${x.sessions}`}>
              <i style={{ height: `${(x.totalUsers / usersMax) * 100}%`, background: "#FFC629" }} />
              <i style={{ height: `${(x.sessions / usersMax) * 100}%`, background: "#6fa8ff" }} />
            </div>
          ))}
        </div>
      </Card>

      <div className="an-grid an-grid--2">
        <Card title={t("География — страны")} sub={t("Страна · пользователи")}>
          <div className="an-list">
            {d.countries.slice(0, 7).map((c) => (
              <BarRow key={c.country} label={c.country} value={fmtNum(c.totalUsers)} sub={`${Math.round((c.totalUsers / countryTotal) * 100)}%`} pct={(c.totalUsers / d.countries[0].totalUsers) * 100} color="var(--accent)" />
            ))}
          </div>
        </Card>
        <Card title={t("Города и регионы")} sub={t("Город / регион · сессии")}>
          <div className="an-rows">
            {d.cities.slice(0, 8).map((c) => (
              <div key={c.city + c.region}>
                <span>
                  {c.city} <span className="faint">· {c.region}</span>
                </span>
                <b className="accent">{fmtNum(c.sessions)}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="an-grid an-grid--2">
        <Card title={t("Возраст")}>
          {ageTotal ? <Columns height={150} showValues format={(v) => `${Math.round((v / ageTotal) * 100)}%`} items={ages.map((a) => ({ key: a.userAgeBracket, label: a.userAgeBracket, value: a.totalUsers }))} /> : <Empty>{t("Демография недоступна — включите Google Signals в GA4.")}</Empty>}
        </Card>
        <Card title={t("Пол")}>
          {gTotal ? (
            <div className="an-gender">
              <div className="an-gender__bar">
                <i style={{ width: `${male}%` }} />
                <i style={{ width: `${100 - male}%` }} />
              </div>
              <div className="an-gender__legend">
                <span>
                  <b className="an-blue">● {t("Мужчины")}</b> {male}%
                </span>
                <span>
                  <b className="an-pink">● {t("Женщины")}</b> {100 - male}%
                </span>
              </div>
            </div>
          ) : (
            <Empty>{t("Демография недоступна — включите Google Signals в GA4.")}</Empty>
          )}
          {d.interests.length > 0 && (
            <div className="an-interests">
              <div className="an-cap">{t("Интересы (affinity)")}</div>
              {d.interests.map((i) => (
                <div key={i.brandingInterest}>
                  <span>{i.brandingInterest}</span>
                  <b>{Math.round((i.totalUsers / intTotal) * 100)}%</b>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title={t("Привлечение трафика — каналы")} className="an-card--table">
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th>{t("Канал")}</th>
                <th className="num">{t("Пользователи")}</th>
                <th className="num">{t("Сессии")}</th>
                <th className="num">{t("Вовлеч.")}</th>
                <th className="num">{t("Ср. время")}</th>
                <th className="num">{t("Конверсии")}</th>
              </tr>
            </thead>
            <tbody>
              {d.channels.map((c, i) => (
                <tr key={c.sessionDefaultChannelGroup}>
                  <td>
                    <i className="an-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                    {CHANNELS[c.sessionDefaultChannelGroup] || c.sessionDefaultChannelGroup}
                  </td>
                  <td className="num">{fmtNum(c.totalUsers)}</td>
                  <td className="num">{fmtNum(c.sessions)}</td>
                  <td className="num faint">{fmtPct(c.sessions ? (c.engagedSessions / c.sessions) * 100 : 0)}</td>
                  <td className="num faint mono">{fmtDur(c.averageSessionDuration)}</td>
                  <td className="num good">{fmtNum(c.keyEvents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {d.adsCampaigns.length > 0 && (
        <Card
          title={
            <span className="an-gads">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z" />
              </svg>
              {t("Google Ads — кампании")}
              <span className="an-pill is-ok">
                <i />
                {t("связано")}
              </span>
            </span>
          }
          className="an-card--table"
        >
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>{t("Кампания")}</th>
                  <th className="num">{t("Клики")}</th>
                  <th className="num">{t("Расход")}</th>
                  <th className="num">CPC</th>
                  <th className="num">{t("Конверсии")}</th>
                  <th className="num">CPA</th>
                </tr>
              </thead>
              <tbody>
                {d.adsCampaigns.map((c) => (
                  <tr key={c.sessionGoogleAdsCampaignName}>
                    <td className="mono">{c.sessionGoogleAdsCampaignName}</td>
                    <td className="num">{fmtNum(c.advertiserAdClicks)}</td>
                    <td className="num">{fmtMoney(c.advertiserAdCost, d.currency, 0)}</td>
                    <td className="num faint">{fmtMoney(c.advertiserAdCostPerClick, d.currency, 2)}</td>
                    <td className="num good">{fmtNum(c.keyEvents)}</td>
                    <td className="num faint">{c.keyEvents ? fmtMoney(c.advertiserAdCost / c.keyEvents, d.currency, 1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="an-grid an-grid--2">
        <Card title={t("Целевые страницы")}>
          <div className="an-list">
            {d.landings.map((l, i) => (
              <BarRow key={l.landingPage} label={l.landingPage || "/"} value={fmtNum(l.sessions)} sub={tt("{0} конв.", fmtNum(l.keyEvents))} pct={(l.sessions / d.landings[0].sessions) * 100} color={PALETTE[i % PALETTE.length]} />
            ))}
          </div>
        </Card>
        <Card title={t("Вовлечённость")}>
          <div className="an-rows">
            <div>
              <span>{t("Вовлечённые сессии")}</span>
              <b>{fmtPct((k.engagementRate || 0) * 100)}</b>
            </div>
            <div>
              <span>{t("Отказы")}</span>
              <b>{fmtPct((k.bounceRate || 0) * 100)}</b>
            </div>
            <div>
              <span>{t("Страниц за сессию")}</span>
              <b>{fmtNum(k.screenPageViewsPerSession, 2)}</b>
            </div>
            <div>
              <span>{t("Ср. время сессии")}</span>
              <b className="mono">{fmtDur(k.averageSessionDuration)}</b>
            </div>
            <div>
              <span>{t("Просмотров")}</span>
              <b>{fmtNum(k.screenPageViews)}</b>
            </div>
          </div>
        </Card>
      </div>

      <Card title={t("События и конверсии")} className="an-card--table">
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th>{t("Событие")}</th>
                <th className="num">{t("Кол-во")}</th>
                <th className="num">{t("Польз.")}</th>
                <th className="num">{t("Конв.")}</th>
              </tr>
            </thead>
            <tbody>
              {d.events.map((e) => (
                <tr key={e.eventName}>
                  <td className="mono">{e.eventName}</td>
                  <td className="num">{fmtNum(e.eventCount)}</td>
                  <td className="num faint">{fmtNum(e.totalUsers)}</td>
                  <td className="num">{e.keyEvents ? <span className="good">★ {fmtNum(e.keyEvents)}</span> : <span className="faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {funnel.length > 1 && (
        <Card title={t("Воронка (Funnel exploration)")} sub={t("Путь пользователя по ключевым событиям сайта.")}>
          <div className="an-gafunnel">
            {funnel.map((f, i) => {
              const pctV = (f.count / fTop) * 100;
              const drop = i ? funnel[i - 1].count - f.count : 0;
              return (
                <div key={f.name}>
                  <div className="an-gafunnel__top">
                    <span>{f.label}</span>
                    <span>
                      <b>{fmtNum(f.count)}</b> <span className="faint">· {fmtNum(pctV, 0)}%</span>
                    </span>
                  </div>
                  <div className="an-gafunnel__bar">
                    <div style={{ width: `${pctV}%` }}>{i > 0 && drop > 0 ? `−${fmtNum(drop)}` : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
