/**
 * Мова адмінки: російська (основна, тексти в коді) або українська (словник i18n-uk.js).
 * Перемикач зберігає вибір у браузері й перезавантажує сторінку — тексти беруться при старті.
 */
import UK from "./i18n-uk.js";

const KEY = "admin-lang";
export const LANGS = [
  { code: "ru", label: "RU", name: "Русский" },
  { code: "uk", label: "UA", name: "Українська" },
];

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "ru" || saved === "uk") return saved;
  } catch {
    /* приватний режим */
  }
  return /^uk\b/i.test(navigator.language || "") ? "uk" : "ru";
}

export const LANG = detect();
export const LOCALE = LANG === "uk" ? "uk-UA" : "ru-RU";

if (typeof document !== "undefined") document.documentElement.lang = LANG;

/** Переклад рядка (ключ — російський текст) */
export const t = (text) => (LANG === "uk" && UK[text] !== undefined ? UK[text] : text);

/** Рядок із підстановками: tt("Просрочено задач: {0}", n) */
export const tt = (template, ...args) =>
  t(template)
    .replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""))
    .replace(/\{\{/g, "{")
    .replace(/\}\}/g, "}");

export function setLang(code) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* приватний режим */
  }
  window.location.reload();
}
