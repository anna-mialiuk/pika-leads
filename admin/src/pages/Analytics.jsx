import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ErrorAlert } from "../components/ui";
import { api } from "../lib/api";
import { PERIODS, analyze, formatMinutes, pct } from "../lib/analytics";
import { useMeta } from "../lib/meta";

import "./Analytics.css";
import { t, tt } from "../lib/i18n";

const PERIOD_KEY = "pika-analytics-period";
const DAY_NAMES = [t("вс"), t("пн"), t("вт"), t("ср"), t("чт"), t("пт"), t("сб")];
const MONTHS = [t("янв"), t("фев"), t("мар"), t("апр"), t("мая"), t("июн"), t("июл"), t("авг"), t("сен"), t("окт"), t("ноя"), t("дек")];

const fmtDay = (time) => {
  const d = new Date(time);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** Зміна відносно попереднього періоду: ▲ 12% / ▼ 5% */
function Delta({ now, prev, better = "up", suffix = "%", absolute = false }) {
  if (prev === null || prev === undefined || now === null || now === undefined) return null;
  // мало даних у минулому періоді — відсотки безглузді («▲ 3000%»), показуємо як було
  if (!absolute && prev < 5) return <span className="delta delta--flat">{t("было")}{" "}{prev}</span>;
  const diff = absolute ? now - prev : Math.round(((now - prev) / prev) * 100);
  if (!diff) return <span className="delta delta--flat">{t("без изменений")}</span>;
  const good = better === "up" ? diff > 0 : diff < 0;
  return (
    <span className={`delta ${good ? "delta--good" : "delta--bad"}`} title={t("К предыдущему такому же периоду")}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
      {suffix}
    </span>
  );
}

function Kpi({ label, value, sub, delta }) {
  return (
    <div className="kpi card">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__sub">
        {delta}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

/** Заявки по днях: стовпчики, підказка при наведенні */
function DailyChart({ buckets, step }) {
  const [hover, setHover] = useState(null);
  // вісь: парний максимум, щоб середня позначка була цілою
  const max = Math.max(2, Math.ceil(Math.max(...buckets.map((b) => b.leads)) / 2) * 2);
  const ticks = [max, max / 2, 0];
  const narrow = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
  const labelEvery = Math.ceil(buckets.length / (narrow ? 5 : 10));
  const active = hover !== null ? buckets[hover] : null;

  return (
    <div className="daily">
      <div className="daily__axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} style={{ bottom: `${(tick / max) * 100}%` }}>
            {tick}
          </span>
        ))}
      </div>
      <div className="daily__plot" onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <div key={tick} className="daily__grid" style={{ bottom: `${(tick / max) * 100}%` }} />
        ))}
        <div className="daily__bars">
          {buckets.map((b, i) => (
            <div
              key={b.from}
              className={`daily__col ${hover === i ? "is-hover" : ""}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
            >
              <div className="daily__bar" style={{ height: `${(b.leads / max) * 100}%` }}>
                {b.sales > 0 && <span className="daily__sale" style={{ height: `${(b.sales / b.leads) * 100}%` }} />}
              </div>
              {i % labelEvery === 0 && (
                <span className="daily__label">
                  {fmtDay(b.from)}
                  {step === 1 && buckets.length <= 14 ? ` ${DAY_NAMES[new Date(b.from).getDay()]}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
        {active && (
          <div className="daily__tip" style={{ left: `${((hover + 0.5) / buckets.length) * 100}%` }}>
            <b>{step === 1 ? fmtDay(active.from) : `${fmtDay(active.from)} — ${fmtDay(active.to - 1)}`}</b>
            <span>{t("Заявок:")}{" "}<b>{active.leads}</b>
            </span>
            <span>{t("Продаж:")}{" "}<b>{active.sales}</b>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Bar({ value, max, color }) {
  return (
    <div className="hbar">
      <div className="hbar__fill" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

/** Таблиця груп (джерела, кампанії, менеджери…) */
function GroupTable({ rows, label, extra = [], empty = t("Нет данных за период") }) {
  if (!rows.length) return <div className="an-empty">{empty}</div>;
  const max = Math.max(...rows.map((r) => r.leads));
  return (
    <div className="an-table-wrap">
      <table className="an-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th className="num">{t("Заявки")}</th>
            <th className="num">{t("Продажи")}</th>
            <th className="num">{t("Конверсия")}</th>
            {extra.map((c) => (
              <th key={c.label} className="num">
                {c.label}
              </th>
            ))}
            <th className="an-table__bar" aria-label={t("Доля")} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="an-table__name">
                {row.flag && <span className="an-flag">{row.flag}</span>}
                <span className={row.unassigned ? "faint" : ""}>{row.label}</span>
                {row.source && <small className="faint">{row.source}</small>}
              </td>
              <td className="num">
                <b>{row.leads}</b> <span className="faint">{row.share}%</span>
              </td>
              <td className="num">{row.sales}</td>
              <td className={`num conv ${row.sales ? "conv--some" : ""}`}>{row.conversion}%</td>
              {extra.map((c) => (
                <td key={c.label} className="num">
                  {c.value(row)}
                </td>
              ))}
              <td className="an-table__bar">
                <Bar value={row.leads} max={max} color="var(--accent)" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Analytics() {
  const { users, types, statusByCode } = useMeta();
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState("");
  const [periodKey, setPeriodKey] = useState(() => {
    try {
      return localStorage.getItem(PERIOD_KEY) || "30";
    } catch {
      return "30";
    }
  });

  useEffect(() => {
    api("/leads")
      .then(({ leads: list }) => setLeads(list))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[1];
  const data = useMemo(() => (leads ? analyze(leads, period, { users, types }) : null), [leads, period, users, types]);

  const choose = (key) => {
    setPeriodKey(key);
    try {
      localStorage.setItem(PERIOD_KEY, key);
    } catch {
      /* немає доступу до сховища */
    }
  };

  return (
    <div className="analytics">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("Аналитика")}</h1>
          <p className="page-text">{t("Заявки с сайта: динамика, воронка, источники и работа менеджеров.")}</p>
        </div>
        <div className="segmented" role="tablist" aria-label={t("Период")}>
          {PERIODS.map((p) => (
            <button key={p.key} type="button" className={p.key === period.key ? "is-active" : ""} onClick={() => choose(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorAlert error={error} />
      {!data && !error && (
        <div className="content-loading">
          <div className="spinner" />
        </div>
      )}

      {data && (
        <>
          <div className="kpis">
            <Kpi
              label={t("Заявки")}
              value={data.kpi.total}
              delta={<Delta now={data.kpi.total} prev={data.prevKpi?.total} />}
              sub={data.prevKpi ? t("к прошлому периоду") : t("за всё время")}
            />
            <Kpi
              label={t("Продажи")}
              value={data.kpi.sales}
              delta={<Delta now={data.kpi.conversion} prev={data.prevKpi?.conversion} absolute suffix={t(" п.п.")} />}
              sub={tt("конверсия {0}%", data.kpi.conversion)}
            />
            <Kpi
              label={t("В работе")}
              value={data.kpi.open}
              sub={data.kpi.untouched ? tt("из них не обработано: {0}", data.kpi.untouched) : t("все заявки обработаны")}
            />
            <Kpi
              label={t("Скорость реакции")}
              value={formatMinutes(data.kpi.reaction)}
              delta={
                data.kpi.reaction !== null && data.prevKpi?.reaction != null ? (
                  <Delta now={Math.round(data.kpi.reaction)} prev={Math.round(data.prevKpi.reaction)} better="down" />
                ) : null
              }
              sub={t("медиана: от заявки до первого статуса")}
            />
          </div>

          <section className="card an-card">
            <div className="an-card__head">
              <h2>{t("Заявки по")}{" "}{data.step === 1 ? t("дням") : t("неделям")}</h2>
              <div className="an-legend">
                <span>
                  <i className="an-legend__lead" />{" "}{t("Заявки")}</span>
                <span>
                  <i className="an-legend__sale" />{" "}{t("Из них продажи")}</span>
              </div>
            </div>
            {data.kpi.total ? (
              <DailyChart buckets={data.buckets} step={data.step} />
            ) : (
              <div className="an-empty">{t("За этот период заявок нет")}</div>
            )}
          </section>

          <div className="an-grid an-grid--funnel">
            <section className="card an-card">
              <div className="an-card__head">
                <h2>{t("Воронка")}</h2>
                <span className="faint">{t("сколько заявок дошли до этапа")}</span>
              </div>
              <div className="funnel">
                {data.funnel.map((stage, i) => (
                  <div key={stage.key} className="funnel__stage">
                    <div className="funnel__row">
                      <span className="funnel__label">{stage.label}</span>
                      <span className="funnel__count">
                        <b>{stage.count}</b> <span className="faint">{pct(stage.count, data.kpi.total)}%</span>
                      </span>
                    </div>
                    <Bar
                      value={stage.count}
                      max={data.funnel[0].count}
                      color={i === data.funnel.length - 1 ? "var(--ok)" : "var(--accent)"}
                    />
                    {stage.toNext !== null && stage.count > 0 && (
                      <div className="funnel__step">
                        ↓ {stage.toNext}{t("% дальше")}{stage.lost > 0 && <span>{" "}{t("· теряется")}{" "}{stage.lost}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="an-stack">
              <section className="card an-card an-card--alert">
                <div className="an-card__eyebrow">{t("⚠ Узкое место")}</div>
                {data.bottleneck && data.bottleneck.toNext < 100 ? (
                  <>
                    <h2>
                      {data.bottleneck.label} → {data.funnel[data.funnel.indexOf(data.bottleneck) + 1].label}
                    </h2>
                    <p>{t("Здесь теряется")}{" "}{100 - data.bottleneck.toNext}{t("% заявок (")}{data.bottleneck.lost}{t(") — самая большая потеря в воронке.")}</p>
                  </>
                ) : (
                  <p>{t("Пока недостаточно данных.")}</p>
                )}
              </section>
              <section className="card an-card">
                <div className="an-card__head">
                  <h2>{t("Где теряем")}</h2>
                  <span className="faint">{t("текущий статус")}</span>
                </div>
                {data.losses.map(({ code, count }) => (
                  <div key={code} className="loss">
                    <div className="funnel__row">
                      <span className="loss__label">
                        <i style={{ background: statusByCode[code]?.color }} />
                        {statusByCode[code]?.label || code}
                      </span>
                      <span>
                        <b>{count}</b> <span className="faint">{pct(count, data.kpi.total)}%</span>
                      </span>
                    </div>
                    <Bar value={count} max={Math.max(1, ...data.losses.map((l) => l.count))} color="var(--danger)" />
                  </div>
                ))}
              </section>
            </div>
          </div>

          <section className="card an-card">
            <div className="an-card__head">
              <h2>{t("Источники")}</h2>
              <span className="faint">{t("utm_source; без меток — по gclid / fbclid, иначе «Сайт»")}</span>
            </div>
            <GroupTable rows={data.sources} label={t("Источник")} />
          </section>

          {data.campaigns.length > 0 && (
            <section className="card an-card">
              <div className="an-card__head">
                <h2>{t("Кампании")}</h2>
                <span className="faint">{t("топ-10 по utm_campaign")}</span>
              </div>
              <GroupTable rows={data.campaigns} label={t("Кампания")} />
            </section>
          )}

          <section className="card an-card">
            <div className="an-card__head">
              <h2>{t("Менеджеры")}</h2>
              <Link to="/leads" className="faint">{t("Открыть CRM →")}</Link>
            </div>
            <GroupTable
              rows={data.managers}
              label={t("Менеджер")}
              extra={[
                { label: t("В работе"), value: (r) => r.open },
                { label: t("Реакция"), value: (r) => formatMinutes(r.reaction) },
              ]}
            />
          </section>

          <div className="an-grid an-grid--three">
            <section className="card an-card">
              <div className="an-card__head">
                <h2>{t("Страны")}</h2>
                <span className="faint">{t("по коду телефона")}</span>
              </div>
              <ShareList rows={data.countries} />
            </section>
            <section className="card an-card">
              <div className="an-card__head">
                <h2>{t("Формы на сайте")}</h2>
              </div>
              <ShareList rows={data.forms} />
            </section>
            <section className="card an-card">
              <div className="an-card__head">
                <h2>{t("Язык сайта")}</h2>
              </div>
              <ShareList rows={data.languages} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function ShareList({ rows }) {
  if (!rows.length) return <div className="an-empty">{t("Нет данных за период")}</div>;
  const max = Math.max(...rows.map((r) => r.leads));
  return (
    <div className="share-list">
      {rows.slice(0, 8).map((row) => (
        <div key={row.key} className="loss">
          <div className="funnel__row">
            <span className="loss__label">
              {row.flag && <span className="an-flag">{row.flag}</span>}
              {row.label}
            </span>
            <span>
              <b>{row.leads}</b> <span className="faint">{row.share}%</span>
              {row.sales > 0 && <span className="share-list__sales"> · {row.sales}{" "}{t("прод.")}</span>}
            </span>
          </div>
          <Bar value={row.leads} max={max} color="var(--accent)" />
        </div>
      ))}
    </div>
  );
}

export default Analytics;
