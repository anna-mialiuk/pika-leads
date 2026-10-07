import { LANGUAGES, getLanguage } from "./config";

const prefixedLanguages = LANGUAGES.filter(({ prefix }) => prefix);

const isExternal = (href) =>
  /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(href) || href.startsWith("#");

/** "/en/cases/x" → "/cases/x" */
export function stripLanguagePrefix(pathname = "/") {
  const language = prefixedLanguages.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!language) return pathname || "/";

  return pathname.slice(language.prefix.length) || "/";
}

/**
 * Додає мовний префікс до внутрішнього шляху.
 * localizePath("/cases", "en")      → "/en/cases"
 * localizePath("/#services", "en")  → "/en#services"
 * localizePath("/", "en")           → "/en"
 * Зовнішні посилання, mailto:, tel: та "#hash" повертаються без змін.
 */
export function localizePath(href, languageCode) {
  if (typeof href !== "string" || !href.startsWith("/") || isExternal(href)) {
    return href;
  }

  const { prefix } = getLanguage(languageCode);

  if (!prefix) return href;

  const match = href.match(/^([^?#]*)(.*)$/);
  const path = stripLanguagePrefix(match[1] || "/");
  const rest = match[2];

  return `${prefix}${path === "/" ? "" : path}${rest}` || "/";
}
