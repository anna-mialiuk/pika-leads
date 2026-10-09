import { useMemo, useState } from "react";

import { analyze, formatMinutes, pct } from "../../lib/analytics";
import { t, tt } from "../../lib/i18n";
import { useMeta } from "../../lib/meta";
import { BarRow, Card, Columns, Donut, Empty, Kpi, Loading, NeedSource, Spark, Trend } from "./parts";
import { PALETTE, deltaPct, fmtDur, fmtMoney, fmtNum, fmtPct, useApi } from "./data";

const DAY = 86_400_000;
const PERIODS = [
  ["today", t("Сегодня")],
  ["yesterday", t("Вчера")],
  ["3d", t("3 дня")],
  ["7d", t("7 дней")],
  ["14d", t("14 дней")],
  ["30d", t("30 дней")],
  ["90d", t("90 дней")],
  ["quarter", t("Квартал")],
  ["custom", t("Свой период")],
];
const SOURCES = [
  ["all", t("Все источники")],
  ["meta", "Meta Ads"],
  ["google", "Google Ads"],
  ["tiktok", "TikTok"],
  ["telegram", "Telegram"],
  ["x", "X (Twitter)"],
  ["linkedin", "LinkedIn"],
];

const iso = (time) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const startOfDay = (time) => {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Період → { from, to } (to — не включно) */
function rangeOf(period, custom) {
  const today = startOfDay(Date.now());
  const back = (n) => ({ from: today - (n - 1) * DAY, to: today + DAY });
  switch (period) {
    case "today":
      return back(1);
    case "yesterday":
      return { from: today - DAY, to: today };
    case "3d":
      return back(3);
    case "7d":
      return back(7);
    case "14d":
      return back(14);
    case "90d":
      return back(90);
    case "quarter": {
      const d = new Date();
      const q = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
      return { from: q, to: today + DAY };
    }
    case "custom":
      if (custom.from && custom.to && custom.from <= custom.to) return { from: startOfDay(Date.parse(custom.from)), to: startOfDay(Date.parse(custom.to)) + DAY };
      return back(30);
    default:
      return back(30);
  }
}

/** Платформа заявки за utm_source / click id */
function platformOf(lead) {
  const a = lead.attribution || {};
  const src = String(a.utm_source || "").toLowerCase();
  if (/facebook|^fb$|instagram|^ig$|meta/.test(src) || (!src && a.fbclid)) return "meta";
  if (/google|adwords/.test(src) || (!src && a.gclid)) return "google";
  if (/tiktok|^tt$/.test(src) || (!src && a.ttclid)) return "tiktok";
  if (/telegram|^tg$|t\.me/.test(src)) return "telegram";
  if (/twitter|^x$/.test(src)) return "x";
  if (/linkedin/.test(src)) return "linkedin";
  return src ? "other" : "direct";
}

const CHANNEL_NAMES = {
  "Organic Search": t("Органика"),
  "Paid Social": t("Платные соцсети"),
  "Paid Search": t("Платный поиск"),
  Direct: t("Прямые"),
  Referral: t("Реферальный"),
  "Organic Social": t("Соцсети"),
  Email: "Email",
  Unassigned: t("Без канала"),
};
const DEVICE_NAMES = { mobile: t("Мобильные"), desktop: t("Десктоп"), tablet: t("Планшеты") };
const GENDER = { male: t("Мужчины"), female: t("Женщины") };

export default function CrmTab({ go, gaReady }) {
  const { users } = useMeta();
  const [period, setPeriod] = useState("30d");
  const [custom, setCustom] = useState(() => ({ from: iso(Date.now() - 29 * DAY), to: iso(Date.now()) }));
  const [source, setSource] = useState("all");
  const [utm, setUtm] = useState("all");
  const [buyer, setBuyer] = useState("all");

  const range = useMemo(() => rangeOf(period, custom), [period, custom]);
  const fromIso = iso(range.from);
  const toIso = iso(range.to - 1);

  const leadsQ = useApi("/leads");
  const adsQ = useApi(`/analytics/ads?from=${fromIso}&to=${toIso}`);
  const gaQ = useApi(`/analytics/ga4?from=${fromIso}&to=${toIso}`, { enabled: gaReady, ttl: 10 * 60_000 });
  const settingsGoals = adsQ.data?.settings?.goals;

  const allLeads = useMemo(() => (leadsQ.data?.leads || []).filter((l) => !l.deleted), [leadsQ.data]);
  const cabinets = useMemo(() => adsQ.data?.cabinets || [], [adsQ.data]);
  const campaignCab = useMemo(() => adsQ.data?.campaigns || {}, [adsQ.data]);
  const cabById = useMemo(() => Object.fromEntries(cabinets.map((c) => [c.id, c])), [cabinets]);

  const campaignOptions = useMemo(() => [...new Set(allLeads.map((l) => l.attribution?.utm_campaign).filter(Boolean))].sort(), [allLeads]);
  const buyers = useMemo(() => {
    const ids = new Set(cabinets.map((c) => c.buyerId).filter(Boolean));
    return users.filter((u) => ids.has(u.id) || u.role === "buyer");
  }, [users, cabinets]);

  // фільтри заявок
  const leads = useMemo(
    () =>
      allLeads.filter((l) => {
        if (source !== "all" && platformOf(l) !== source) return false;
        const camp = l.attribution?.utm_campaign || "";
        if (utm !== "all" && camp !== utm) return false;
        if (buyer !== "all") {
          const cab = cabById[campaignCab[camp.trim().toLowerCase()]];
          if (!cab || String(cab.buyerId) !== buyer) return false;
        }
        return true;
      }),
    [allLeads, source, utm, buyer, cabById, campaignCab],
  );
  const a = useMemo(() => analyze(leads, { from: range.from, to: range.to }, { users }), [leads, range, users]);
  const inPeriod = useMemo(() => leads.filter((l) => {
    const time = new Date(l.createdAt).getTime();
    return time >= range.from && time < range.to;
  }), [leads, range]);

  // кабінети під фільтри
  const cabs = cabinets.filter((c) => (source === "all" || c.platform === source) && (buyer === "all" || String(c.buyerId) === buyer));
  const campSpend = useMemo(() => {
    const map = {};
    for (const c of cabinets) for (const x of c.summary.campaigns) map[x.name.trim().toLowerCase()] = (map[x.name.trim().toLowerCase()] || 0) + x.spend;
    return map;
  }, [cabinets]);
  const spend = utm !== "all" ? campSpend[utm.toLowerCase()] || 0 : cabs.reduce((s, c) => s + c.summary.spend, 0);
  const cur = cabinets[0]?.currency || inPeriod.find((l) => l.currency)?.currency || "USD";
  const sales = inPeriod.filter((l) => l.status === "sale");
  const revenue = sales.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const romi = spend ? ((revenue - spend) / spend) * 100 : null;

  const reset = () => {
    setPeriod("30d");
    setSource("all");
    setUtm("all");
    setBuyer("all");
  };

  const utmRows = useUtmRows(inPeriod, campSpend);

  if (leadsQ.loading || adsQ.loading) return <Loading />;
  const ga = gaReady ? gaQ.data : null;
  const goals = settingsGoals || { newUsers: 20000, views: 250000, sessions: 85000, bounce: 30 };

  // ---------- GA-блоки ----------
  const kpiGa = ga?.kpi || {};
  const goalBars = ga
    ? [
        { label: t("Новые пользователи"), value: kpiGa.newUsers, goal: goals.newUsers, color: "#4fd8c8" },
        { label: t("Просмотры страниц"), value: kpiGa.screenPageViews, goal: goals.views, color: "#f0883e" },
        { label: t("Сессии"), value: kpiGa.sessions, goal: goals.sessions, color: "#ff6fae" },
        { label: t("Показатель отказов"), value: (kpiGa.bounceRate || 0) * 100, goal: goals.bounce, color: "#6fa8ff", pct: true },
      ]
    : [];
  const channels = (ga?.channels || []).slice(0, 4);
  const chTotal = channels.reduce((s, c) => s + c.sessions, 0);
  const devices = ga?.devices || [];
  const pagesTotal = (ga?.pages || []).reduce((s, p) => s + p.screenPageViews, 0);

  // ---------- воронка ----------
  const funnel = a.funnel;
  const FUNNEL_COLORS = ["#FFC629", "#6fa8ff", "#b98bff", "#f0883e", "#4fd8c8", "#5ac878"];

  // ---------- байєри ----------
  const buyerRows = buyers
    .map((u) => {
      const own = cabinets.filter((c) => c.buyerId === u.id);
      const sp = own.reduce((s, c) => s + c.summary.spend, 0);
      const ld = own.reduce((s, c) => s + c.crm.leads, 0);
      const rev = own.reduce((s, c) => s + c.crm.revenue, 0);
      const conv = own.reduce((s, c) => s + c.summary.conv, 0);
      return { id: u.id, name: u.name, cabs: own.length, spend: sp, leads: ld, conv, revenue: rev, cpl: ld ? sp / ld : conv ? sp / conv : 0, roi: sp ? ((rev - sp) / sp) * 100 : null };
    })
    .filter((r) => r.cabs || r.leads)
    .sort((x, y) => y.spend - x.spend);

  const countries = a.countries.slice(0, 6);
  const cities = (ga?.cities || []).slice(0, 6);
  const ages = (ga?.ages || []).filter((x) => x.userAgeBracket && x.userAgeBracket !== "unknown");
  const ageTotal = ages.reduce((s, x) => s + x.totalUsers, 0);
  const genders = (ga?.genders || []).filter((g) => GENDER[g.userGender]);
  const genderTotal = genders.reduce((s, g) => s + g.totalUsers, 0);
  const male = genderTotal ? Math.round(((genders.find((g) => g.userGender === "male")?.totalUsers || 0) / genderTotal) * 100) : 0;

  // CRM по utm_source для «суперталиці»
  const crmBySource = {};
  for (const l of inPeriod) {
    const src = String(l.attribution?.utm_source || "(direct)").toLowerCase();
    const row = (crmBySource[src] = crmBySource[src] || { leads: 0, sales: 0, revenue: 0 });
    row.leads += 1;
    if (l.status === "sale") {
      row.sales += 1;
      row.revenue += Number(l.amount) || 0;
    }
  }

  return (
    <div className="an-stack">
      <div className="an-filters">
        <select className="select select--sm" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={t("Период")}>
          {PERIODS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        {period === "custom" && (
          <span className="an-filters__dates">
            <input type="date" className="input input--sm" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span>—</span>
            <input type="date" className="input input--sm" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </span>
        )}
        <span className="an-filters__sep" />
        <select className="select select--sm" value={source} onChange={(e) => setSource(e.target.value)} aria-label={t("Источник")}>
          {SOURCES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select className="select select--sm" value={utm} onChange={(e) => setUtm(e.target.value)} aria-label="utm_campaign">
          <option value="all">{t("Все UTM-кампании")}</option>
          {campaignOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="select select--sm" value={buyer} onChange={(e) => setBuyer(e.target.value)} aria-label={t("Байер")}>
          <option value="all">{t("Все баеры")}</option>
          {buyers.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--ghost btn--sm an-filters__reset" onClick={reset}>
          {t("Сбросить")}
        </button>
      </div>

      <div className="an-kpis an-kpis--5">
        <Kpi label={t("Заявок за период")} value={fmtNum(a.kpi.total)} trend={a.prevKpi && <Trend value={deltaPct(a.kpi.total, a.prevKpi.total)} />} />
        <Kpi label={t("Конверсия в продажу")} value={fmtPct(a.kpi.total ? (a.kpi.sales / a.kpi.total) * 100 : 0)} sub={tt("{0} продаж", a.kpi.sales)} />
        <Kpi label={t("Расход")} value={fmtMoney(spend, cur, 0)} sub={cabs.length ? tt("{0} кабинетов", cabs.length) : t("кабинеты не подключены")} />
        <Kpi label={t("Выручка")} value={fmtMoney(revenue, cur, 0)} sub={t("сумма сделок в CRM")} />
        <Kpi label="ROMI" value={romi === null ? "—" : `${romi >= 0 ? "+" : ""}${fmtNum(romi)}%`} color={romi === null ? "var(--muted)" : romi >= 0 ? "var(--green-ink)" : "var(--red-ink)"} />
      </div>

      <div className="an-grid an-grid--aud">
        <Card title={t("Аудитория сайта")} sub={ga ? t("Посетители за выбранный период с разбивкой по целям.") : t("Заявки по дням за выбранный период.")}>
          <div className="an-aud">
            <Columns
              height={190}
              items={
                ga
                  ? ga.daily.map((d, i) => ({ key: d.date, value: d.totalUsers, color: i % 2 ? "#6fa8ff" : "#4fd8c8" }))
                  : a.buckets.map((b, i) => ({ key: b.from, value: b.leads, color: i % 2 ? "#6fa8ff" : "#4fd8c8" }))
              }
            />
            {ga ? (
              <div className="an-goals">
                {goalBars.map((g) => {
                  const p = g.goal ? (g.value / g.goal) * 100 : 0;
                  return (
                    <div key={g.label} className="an-goal">
                      <div className="an-goal__top">
                        <span>{g.label}</span>
                        <span className="faint">{tt("{0}% цели", Math.round(p))}</span>
                      </div>
                      <div className="an-goal__nums">
                        <b>{g.pct ? fmtPct(g.value) : fmtNum(g.value)}</b>
                        <span className="faint">{g.pct ? fmtPct(g.goal) : fmtNum(g.goal)}</span>
                      </div>
                      <div className="an-bar" style={{ height: 6 }}>
                        <div style={{ width: `${Math.min(100, p)}%`, background: g.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <NeedSource name="ga" onGo={() => go("ga")} />
            )}
          </div>
        </Card>
        <Card title={t("Сессии по каналам")}>
          {channels.length ? (
            <div className="an-chan">
              <Donut parts={channels.map((c, i) => ({ label: c.sessionDefaultChannelGroup, value: c.sessions, color: ["#ff6fae", "#6fa8ff", "#4fd8c8", "#f0883e"][i] }))} />
              <div className="an-chan__legend">
                {channels.map((c, i) => (
                  <div key={c.sessionDefaultChannelGroup}>
                    <span className="an-cap">{CHANNEL_NAMES[c.sessionDefaultChannelGroup] || c.sessionDefaultChannelGroup}</span>
                    <div>
                      <i style={{ background: ["#ff6fae", "#6fa8ff", "#4fd8c8", "#f0883e"][i] }} />
                      <b>{fmtNum(c.sessions)}</b> <span className="faint">{pct(c.sessions, chTotal)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <NeedSource name="ga" onGo={() => go("ga")} />
          )}
        </Card>
      </div>

      <div className="an-grid an-grid--3">
        <Card title={t("Сессии по устройствам")}>
          {devices.length ? (
            <div className="an-devices">
              {devices.map((d, i) => (
                <div key={d.deviceCategory}>
                  <span>
                    <i style={{ background: ["#6fa8ff", "#4fd8c8", "#8a8f98"][i] || "#8a8f98" }} />
                    {DEVICE_NAMES[d.deviceCategory] || d.deviceCategory}
                  </span>
                  <b>{fmtNum(d.sessions)}</b>
                </div>
              ))}
            </div>
          ) : (
            <NeedSource name="ga" onGo={() => go("ga")} />
          )}
        </Card>
        <ConvCard
          value={fmtNum(ga ? ga.daily.reduce((s, d) => s + d.advertiserAdClicks, 0) || cabs.reduce((s, c) => s + c.summary.clicks, 0) : cabs.reduce((s, c) => s + c.summary.clicks, 0))}
          label={t("Клики по объявлениям")}
          sub={t("Клики, приведшие к показу")}
          color="#6fa8ff"
          bars={ga ? ga.daily.map((d) => d.advertiserAdClicks) : cabs[0]?.summary.daily.map((d) => d.clicks) || []}
        />
        <ConvCard
          value={ga ? fmtNum(kpiGa.screenPageViews / Math.max(1, ga.daily.length)) : "—"}
          label={t("Просмотры")}
          sub={t("Среднее число просмотров в день")}
          color="#4fd8c8"
          bars={ga ? ga.daily.map((d) => d.screenPageViews) : []}
        />
        <ConvCard
          value={ga ? fmtNum(kpiGa.keyEvents) : fmtNum(a.kpi.total)}
          label={ga ? t("Всего конверсий") : t("Заявок")}
          sub={ga ? t("Ключевые события GA4 за период") : t("из CRM за период")}
          color="#ff6fae"
          bars={ga ? ga.daily.map((d) => d.keyEvents) : a.buckets.map((b) => b.leads)}
        />
      </div>

      <div className="an-grid an-grid--pages">
        <Card title={t("Посещаемость страниц")}>
          {ga?.pages?.length ? (
            <div className="an-list">
              {ga.pages.slice(0, 6).map((p, i) => (
                <BarRow key={p.pagePath} label={p.pagePath} value={fmtPct((p.screenPageViews / pagesTotal) * 100, 2)} pct={(p.screenPageViews / ga.pages[0].screenPageViews) * 100} color={PALETTE[i % PALETTE.length]} />
              ))}
            </div>
          ) : (
            <NeedSource name="ga" onGo={() => go("ga")} />
          )}
        </Card>
        <Card title={t("Браузеры посетителей")} className="an-card--table">
          {ga?.browsers?.length ? (
            <div className="an-table-wrap">
              <table className="an-table">
                <thead>
                  <tr>
                    <th>{t("Браузер")}</th>
                    <th className="num">{t("Сессии")}</th>
                    <th className="num">{t("Отказы")}</th>
                    <th className="num">{t("Конверсия")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ga.browsers.slice(0, 6).map((b, i) => (
                    <tr key={b.browser}>
                      <td>
                        <i className="an-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {b.browser}
                      </td>
                      <td className="num">
                        <b>{fmtNum(b.sessions)}</b>
                      </td>
                      <td className="num faint">{fmtPct(b.bounceRate * 100, 2)}</td>
                      <td className="num good">{fmtPct(b.sessions ? (b.keyEvents / b.sessions) * 100 : 0, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NeedSource name="ga" onGo={() => go("ga")} />
          )}
        </Card>
      </div>

      {ga?.sources?.length > 0 && (
        <Card className="an-card--table">
          <div className="an-table-wrap">
            <table className="an-table an-table--super">
              <thead>
                <tr className="an-table__groups">
                  <th />
                  <th colSpan={3}>{t("Привлечение")}</th>
                  <th colSpan={3}>{t("Поведение")}</th>
                  <th colSpan={3}>{t("Конверсии (CRM)")}</th>
                </tr>
                <tr>
                  <th>{t("Источник")}</th>
                  <th className="num">{t("Польз.")}</th>
                  <th className="num">{t("Новые")}</th>
                  <th className="num">{t("Сессии")}</th>
                  <th className="num">{t("Отказы")}</th>
                  <th className="num">{t("Стр/сес")}</th>
                  <th className="num">{t("Ср. время")}</th>
                  <th className="num">{t("Продажи")}</th>
                  <th className="num">{t("Выручка")}</th>
                  <th className="num">{t("Конв.")}</th>
                </tr>
              </thead>
              <tbody>
                {ga.sources.slice(0, 8).map((r) => {
                  const crm = crmBySource[String(r.sessionSource).toLowerCase()] || { leads: 0, sales: 0, revenue: 0 };
                  return (
                    <tr key={`${r.sessionSource}/${r.sessionMedium}`}>
                      <td className="accent">
                        {r.sessionSource} <span className="faint">/ {r.sessionMedium}</span>
                      </td>
                      <td className="num">{fmtNum(r.totalUsers)}</td>
                      <td className="num faint">{fmtNum(r.newUsers)}</td>
                      <td className="num">{fmtNum(r.sessions)}</td>
                      <td className="num faint">{fmtPct(r.bounceRate * 100, 2)}</td>
                      <td className="num faint">{fmtNum(r.screenPageViewsPerSession, 2)}</td>
                      <td className="num faint mono">{fmtDur(r.averageSessionDuration)}</td>
                      <td className="num">{fmtNum(crm.sales)}</td>
                      <td className="num">
                        <b>{fmtMoney(crm.revenue, cur, 0)}</b>
                      </td>
                      <td className="num good">{fmtPct(r.sessions ? (crm.leads / r.sessions) * 100 : 0, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={t("Воронка продаж")} sub={t("По каждому шагу: сколько дошло, конверсия в следующий шаг и отвал.")}>
        <div className="an-table-wrap">
          <div className="an-funnel">
            {funnel.map((s, i) => (
              <div key={s.key} className="an-funnel__step">
                <div className="an-funnel__box" style={{ "--f": FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}>
                  <div className="an-funnel__label">{s.label}</div>
                  <b>{fmtNum(s.count)}</b>
                  <span>{tt("{0}% от старта", pct(s.count, funnel[0].count))}</span>
                </div>
                {s.toNext !== null && (
                  <div className="an-funnel__next">
                    <span className="good">→ {s.toNext}%</span>
                    <span className="bad">−{fmtNum(s.lost)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="an-grid an-grid--2">
        <Card title={t("География — страны")} sub={t("По коду телефона в заявке")}>
          {countries.length ? (
            <div className="an-list">
              {countries.map((c) => (
                <BarRow key={c.key} label={`${c.flag} ${c.label}`} value={fmtNum(c.leads)} sub={`${c.share}%`} pct={(c.leads / countries[0].leads) * 100} color="var(--accent)" />
              ))}
            </div>
          ) : (
            <Empty>{t("Нет данных за период")}</Empty>
          )}
        </Card>
        <Card title={t("Топ городов")} sub={ga ? t("Сессии по данным GA4") : ""}>
          {cities.length ? (
            <div className="an-rows">
              {cities.map((c) => (
                <div key={`${c.city}${c.region}`}>
                  <span>{c.city}</span>
                  <b className="accent">{fmtNum(c.sessions)}</b>
                </div>
              ))}
            </div>
          ) : (
            <NeedSource name="ga" onGo={() => go("ga")} />
          )}
        </Card>
      </div>

      <div className="an-grid an-grid--demo">
        <Card title={t("Пол")}>
          {genderTotal ? (
            <div className="an-gender">
              <div className="an-gender__bar">
                <i style={{ width: `${male}%` }} />
                <i style={{ width: `${100 - male}%` }} />
              </div>
              <div className="an-gender__legend">
                <span>
                  <b className="an-blue">● {GENDER.male}</b> {male}%
                </span>
                <span>
                  <b className="an-pink">● {GENDER.female}</b> {100 - male}%
                </span>
              </div>
            </div>
          ) : (
            <NeedSource name="ga" onGo={() => go("ga")} />
          )}
        </Card>
        <Card title={t("Возраст")}>
          {ageTotal ? (
            <Columns height={140} showValues format={(v) => `${Math.round((v / ageTotal) * 100)}%`} items={ages.map((x) => ({ key: x.userAgeBracket, label: x.userAgeBracket, value: x.totalUsers, color: "var(--accent)" }))} />
          ) : (
            <NeedSource name="ga" onGo={() => go("ga")} />
          )}
        </Card>
      </div>

      <Card title={t("Разбивка по UTM-меткам")} className="an-card--table">
        {utmRows.length ? (
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>utm_source</th>
                  <th>utm_medium</th>
                  <th>utm_campaign</th>
                  <th className="num">{t("Лидов")}</th>
                  <th className="num">{t("Расход")}</th>
                  <th className="num">CPL</th>
                  <th className="num">ROI</th>
                </tr>
              </thead>
              <tbody>
                {utmRows.map((r) => (
                  <tr key={r.key}>
                    <td className="mono">{r.source}</td>
                    <td className="mono faint">{r.medium}</td>
                    <td className="mono">{r.campaign}</td>
                    <td className="num">
                      <b>{fmtNum(r.leads)}</b>
                    </td>
                    <td className="num faint">{r.spend ? fmtMoney(r.spend, cur, 0) : "—"}</td>
                    <td className="num faint">{r.spend && r.leads ? fmtMoney(r.spend / r.leads, cur, 1) : "—"}</td>
                    <td className={`num ${r.roi === null ? "faint" : r.roi >= 0 ? "good" : "bad"}`}>{r.roi === null ? "—" : `${r.roi >= 0 ? "+" : ""}${fmtNum(r.roi)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t("Заявок с UTM-метками за период нет")}</Empty>
        )}
      </Card>

      <Card title={t("Эффективность баеров")} className="an-card--table">
        {buyerRows.length ? (
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>{t("Баер")}</th>
                  <th className="num">{t("Лидов")}</th>
                  <th className="num">{t("Расход")}</th>
                  <th className="num">CPL</th>
                  <th className="num">ROI</th>
                  <th className="num">{t("Выручка")}</th>
                </tr>
              </thead>
              <tbody>
                {buyerRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.name}</b> <span className="faint">· {tt("{0} каб.", r.cabs)}</span>
                    </td>
                    <td className="num">{fmtNum(r.leads || r.conv)}</td>
                    <td className="num faint">{fmtMoney(r.spend, cur, 0)}</td>
                    <td className="num faint">{r.cpl ? fmtMoney(r.cpl, cur, 1) : "—"}</td>
                    <td className={`num ${r.roi === null ? "faint" : r.roi >= 0 ? "good" : "bad"}`}>{r.roi === null ? "—" : `${r.roi >= 0 ? "+" : ""}${fmtNum(r.roi)}%`}</td>
                    <td className="num">
                      <b>{fmtMoney(r.revenue, cur, 0)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t("Назначьте байеров кабинетам во вкладке «Рекламные кабинеты» — здесь появится их эффективность.")}</Empty>
        )}
      </Card>

      <Card title={t("Менеджеры")} sub={t("Скорость реакции — медиана: от заявки до первого статуса")} className="an-card--table">
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th>{t("Менеджер")}</th>
                <th className="num">{t("Заявок")}</th>
                <th className="num">{t("В работе")}</th>
                <th className="num">{t("Продаж")}</th>
                <th className="num">{t("Конверсия")}</th>
                <th className="num">{t("Реакция")}</th>
              </tr>
            </thead>
            <tbody>
              {a.managers.map((m) => (
                <tr key={m.key}>
                  <td className={m.unassigned ? "faint" : ""}>{m.label}</td>
                  <td className="num">{fmtNum(m.leads)}</td>
                  <td className="num faint">{fmtNum(m.open)}</td>
                  <td className="num">{fmtNum(m.sales)}</td>
                  <td className="num good">{m.conversion}%</td>
                  <td className="num faint">{formatMinutes(m.reaction)}</td>
                </tr>
              ))}
              {!a.managers.length && (
                <tr>
                  <td colSpan={6} className="faint">
                    {t("Нет данных за период")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ConvCard({ value, label, sub, color, bars }) {
  return (
    <section className="an-card an-conv">
      <div>
        <div className="an-conv__value">{value}</div>
        <div className="an-conv__label" style={{ color: `color-mix(in srgb, ${color}, #000 var(--ink-darken, 0%))` }}>
          {label}
        </div>
        <div className="an-conv__sub">{sub}</div>
      </div>
      {bars.length > 0 && <Spark values={bars.slice(-24)} color={color} height={40} />}
    </section>
  );
}

/** Групування заявок за source / medium / campaign + витрати кампанії */
function useUtmRows(list, campSpend) {
  return useMemo(() => {
    const map = new Map();
    for (const l of list) {
      const a = l.attribution || {};
      if (!a.utm_source && !a.utm_campaign) continue;
      const key = `${a.utm_source || ""}|${a.utm_medium || ""}|${a.utm_campaign || ""}`;
      const row = map.get(key) || { key, source: a.utm_source || "—", medium: a.utm_medium || "—", campaign: a.utm_campaign || "—", leads: 0, revenue: 0 };
      row.leads += 1;
      if (l.status === "sale") row.revenue += Number(l.amount) || 0;
      map.set(key, row);
    }
    return [...map.values()]
      .map((r) => {
        const spend = campSpend[String(r.campaign).trim().toLowerCase()] || 0;
        return { ...r, spend, roi: spend ? ((r.revenue - spend) / spend) * 100 : null };
      })
      .sort((x, y) => y.leads - x.leads)
      .slice(0, 15);
  }, [list, campSpend]);
}
