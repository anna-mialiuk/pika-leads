import { useCallback, useContext } from "react";
import { useLocation } from "react-router-dom";

import { LanguageContext } from "./LanguageContext";
import { LANGUAGES, getLanguage } from "./config";
import { localizePath, stripLanguagePrefix } from "./paths";
import { translate } from "./translate";
import { getData } from "./content";

/**
 * Основний хук мультимовності.
 * lang — поточна мова, t — переклад рядка, link — локалізований шлях,
 * switchPath — адреса поточної сторінки іншою мовою.
 */
export function useLanguage() {
  const lang = useContext(LanguageContext);
  const location = useLocation();

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const link = useCallback((href) => localizePath(href, lang), [lang]);

  const switchPath = useCallback(
    (code) =>
      localizePath(
        `${stripLanguagePrefix(location.pathname)}${location.search}`,
        code,
      ),
    [location.pathname, location.search],
  );

  return {
    lang,
    language: getLanguage(lang),
    languages: LANGUAGES,
    t,
    link,
    switchPath,
  };
}

/**
 * Дані з src/data поточною мовою.
 * const { services } = useData("servicesData");
 * Кейси й статті — через хуки з src/content/hooks.js
 */
export function useData(name) {
  const lang = useContext(LanguageContext);

  return getData(name, lang);
}
