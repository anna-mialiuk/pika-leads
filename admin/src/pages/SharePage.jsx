/** Публічний звіт кабінету для клієнта: /share/<токен> (без входу в панель) */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { Prefs } from "../components/ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { t, tt } from "../lib/i18n";
import logoMark from "../assets/logo-mark.svg";
import { Card, Columns } from "./analytics/parts";
import { fmtMoney, fmtNum, fmtPct } from "./analytics/data";

import "./analytics/analytics.css";

export default function SharePage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    document.title = "Pika Leads · Report";
    api(`/share/${encodeURIComponent(token)}`)
      .then((data) => setState({ loading: false, data, error: "" }))
      .catch((e) => setState({ loading: false, data: null, error: e.message }));
  }, [token]);

  const d = state.data;
  return (
    <div className="an-share-page">
      <header className="an-share-page__head">
        <div className="an-share-page__logo">
          <img src={logoMark} alt="" />
          <b>
            PIKA<span>LEADS</span>
          </b>
        </div>
        <Prefs />
      </header>
      {state.loading && (
        <div className="an-loading">
          <div className="spinner" />
        </div>
      )}
      {state.error && <div className="alert">⚠ {state.error}</div>}
      {d && (
        <div className="an-stack">
          <div>
            <h1 className="page-title">{d.name}</h1>
            <p className="page-text">
              {tt("{0} · отчёт за {1} — {2}", d.platform, d.summary.range.from, d.summary.range.to)} · {tt("обновлено {0}", formatDate(d.generatedAt))}
            </p>
          </div>
          <div className="an-kpis an-kpis--6">
            {[
              [t("Расход"), fmtMoney(d.summary.spend, d.currency, 0)],
              [t("Показы"), fmtNum(d.summary.impressions)],
              [t("Клики"), fmtNum(d.summary.clicks)],
              ["CTR", fmtPct(d.summary.ctr, 2)],
              [t("Конверсии"), fmtNum(d.summary.conv)],
              ["CPA", d.summary.cpa ? fmtMoney(d.summary.cpa, d.currency, 1) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="an-kpi">
                <div className="an-kpi__label">{label}</div>
                <div className="an-kpi__value an-kpi__value--sm">{value}</div>
              </div>
            ))}
          </div>
          <Card title={t("Расход по дням")}>
            <Columns height={160} items={d.summary.daily.map((x, i) => ({ key: x.date, value: x.spend, color: i % 2 ? "#6fa8ff" : "#FFC629" }))} />
          </Card>
          <Card title={t("Кампании")} className="an-card--table">
            <div className="an-table-wrap">
              <table className="an-table">
                <thead>
                  <tr>
                    <th>{t("Кампания")}</th>
                    <th className="num">{t("Расход")}</th>
                    <th className="num">{t("Клики")}</th>
                    <th className="num">CTR</th>
                    <th className="num">{t("Конверсии")}</th>
                    <th className="num">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {d.summary.campaigns.map((c) => (
                    <tr key={c.name}>
                      <td className="mono">{c.name}</td>
                      <td className="num">{fmtMoney(c.spend, d.currency, 0)}</td>
                      <td className="num faint">{fmtNum(c.clicks)}</td>
                      <td className="num faint">{fmtPct(c.ctr, 2)}</td>
                      <td className="num">{fmtNum(c.conv)}</td>
                      <td className="num faint">{c.cpa ? fmtMoney(c.cpa, d.currency, 1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
