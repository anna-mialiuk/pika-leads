import { use, useEffect } from "react";
import { Outlet } from "react-router-dom";

import { LanguageContext } from "./LanguageContext";
import { getLanguage } from "./config";
import { loadTranslations } from "./content";

import ConsultationProvider from "../components/ConsultationModal/ConsultationProvider";
import SupportWidget from "../components/SupportWidget/SupportWidget";

/**
 * Обгортка маршрутів однієї мови: задає мову для всього піддерева
 * і перед першим показом довантажує переклади цієї мови.
 */
function LanguageLayout({ lang }) {
  const pending = loadTranslations(lang);

  if (pending) use(pending);

  useEffect(() => {
    document.documentElement.lang = getLanguage(lang).htmlLang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={lang}>
      <ConsultationProvider>
        <Outlet />
        <SupportWidget />
      </ConsultationProvider>
    </LanguageContext.Provider>
  );
}

export default LanguageLayout;
