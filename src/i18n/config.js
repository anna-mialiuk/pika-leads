import uaFlag from "../assets/images/flags/ua.svg";
import ruFlag from "../assets/images/flags/ru-wbw.svg";
import gbFlag from "../assets/images/flags/gb.svg";

/**
 * Мови сайту.
 * flag — SVG-прапор (однаково виглядає на всіх ОС, на відміну від емодзі).
 * prefix — префікс URL: українська без префікса ("/cases"),
 * інші мови — з префіксом ("/en/cases", "/ru/cases").
 */
export const LANGUAGES = [
  {
    code: "uk",
    label: "UA",
    name: "Українська",
    flag: uaFlag,
    prefix: "",
    htmlLang: "uk",
  },
  {
    code: "ru",
    label: "RU",
    name: "Русский",
    flag: ruFlag, // біло-синьо-білий
    prefix: "/ru",
    htmlLang: "ru",
  },
  {
    code: "en",
    label: "EN",
    name: "English",
    flag: gbFlag,
    prefix: "/en",
    htmlLang: "en",
  },
];

export const DEFAULT_LANGUAGE = "uk";

export const getLanguage = (code) =>
  LANGUAGES.find((language) => language.code === code) ||
  LANGUAGES.find((language) => language.code === DEFAULT_LANGUAGE);
