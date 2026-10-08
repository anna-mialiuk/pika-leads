import { Suspense, lazy, use, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { LanguageContext } from "./LanguageContext";
import { getLanguage } from "./config";
import { loadTranslations } from "./content";

import ConsultationProvider from "../components/ConsultationModal/ConsultationProvider";
// чат і попап «Передзвонити» — окремим файлом, після того як сторінка вже показана
const SupportWidget = lazy(
  () => import("../components/SupportWidget/SupportWidget"),
);
const CookieConsent = lazy(
  () => import("../components/CookieConsent/CookieConsent"),
);

/** true через ~1,5 с після завантаження (або коли браузер вільний) */
function useAfterLoad() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => setReady(true);
    const id =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(start, { timeout: 2500 })
        : window.setTimeout(start, 1500);

    return () =>
      "cancelIdleCallback" in window
        ? window.cancelIdleCallback(id)
        : window.clearTimeout(id);
  }, []);

  return ready;
}

/**
 * Обгортка маршрутів однієї мови: задає мову для всього піддерева
 * і перед першим показом довантажує переклади цієї мови.
 */
function LanguageLayout({ lang }) {
  const pending = loadTranslations(lang);
  const widgetReady = useAfterLoad();

  if (pending) use(pending);

  useEffect(() => {
    document.documentElement.lang = getLanguage(lang).htmlLang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={lang}>
      <ConsultationProvider>
        <Outlet />
        {widgetReady && (
          <Suspense fallback={null}>
            <SupportWidget />
            <CookieConsent />
          </Suspense>
        )}
      </ConsultationProvider>
    </LanguageContext.Provider>
  );
}

export default LanguageLayout;
