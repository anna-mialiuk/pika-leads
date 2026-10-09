import { useSearchParams } from "react-router-dom";

import { t } from "../lib/i18n";
import AdsTab from "./analytics/AdsTab";
import ClarityTab from "./analytics/ClarityTab";
import CrmTab from "./analytics/CrmTab";
import GaTab from "./analytics/GaTab";
import OverviewTab from "./analytics/OverviewTab";
import UtmTab from "./analytics/UtmTab";
import { useApi } from "./analytics/data";

import "./analytics/analytics.css";

const I = {
  overview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  crm: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" />
    </svg>
  ),
  ads: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
  utm: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  ),
  ga: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="16" y="3" width="5" height="18" rx="2.5" fill="#F9AB00" />
      <rect x="9.5" y="9" width="5" height="12" rx="2.5" fill="#E37400" />
      <circle cx="5.5" cy="18" r="2.8" fill="#E37400" />
    </svg>
  ),
  clarity: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="#9d8bff" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.2" fill="#9d8bff" />
    </svg>
  ),
};

const TABS = ["overview", "crm", "ads", "utm", "ga", "clarity"];

export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "overview";
  const go = (key) => setParams(key === "overview" ? {} : { tab: key }, { replace: false });

  const ga = useApi("/analytics/ga4/status", { ttl: 5 * 60_000 });
  const clarity = useApi("/analytics/clarity", { ttl: 5 * 60_000 });

  const labels = {
    overview: t("Обзор"),
    crm: t("Сквозная (CRM)"),
    ads: t("Рекламные кабинеты"),
    utm: t("UTM & ссылки"),
    ga: "Google Analytics",
    clarity: "Clarity",
  };
  const badge = {
    ga: ga.data && !ga.data.configured ? t("подключить") : "",
    clarity: clarity.data && !clarity.data.configured ? t("подключить") : "",
  };

  return (
    <div className="an">
      <h1 className="page-title">{t("Аналитика")}</h1>
      <p className="page-text">{t("Сквозная аналитика PikaLeads, данные Google Analytics 4 и тепловые карты Microsoft Clarity — в одном месте.")}</p>

      <div className="an-tabs" role="tablist">
        {TABS.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => go(key)}>
            <span className="an-tabs__icon">{I[key]}</span>
            {labels[key]}
            {badge[key] && <span className="an-tabs__badge">{badge[key]}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab go={go} />}
      {tab === "crm" && <CrmTab go={go} gaReady={Boolean(ga.data?.configured)} />}
      {tab === "ads" && <AdsTab />}
      {tab === "utm" && <UtmTab gaReady={Boolean(ga.data?.configured)} />}
      {tab === "ga" && <GaTab status={ga} />}
      {tab === "clarity" && <ClarityTab state={clarity} />}
    </div>
  );
}
