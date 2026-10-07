import { DEFAULT_LANGUAGE } from "./config";
import { mergeTranslation } from "./merge";

/**
 * Дані сайту й переклади підтягуються автоматично за назвою файлу:
 *   src/data/<name>.js                 — оригінал (українська)
 *   src/i18n/content/<lang>/<name>.js  — переклад, накладається на оригінал
 */
const fileName = (path) => path.match(/([^/]+)\.js$/)[1];

const baseModules = import.meta.glob("../data/*.js", { eager: true });

// Переклади вантажаться окремим чанком на мову — лише коли користувач відкрив цю мову
const translationLoaders = import.meta.glob("./content/*/*.js");

const baseData = Object.fromEntries(
  Object.entries(baseModules).map(([path, module]) => [fileName(path), module]),
);

const translations = {};
const loading = {};

/**
 * Завантажує переклади мови (один раз). Повертає Promise або null,
 * якщо мова вже завантажена чи це мова за замовчуванням.
 */
export function loadTranslations(lang) {
  if (lang === DEFAULT_LANGUAGE || translations[lang]) return null;

  loading[lang] ??= Promise.all(
    Object.entries(translationLoaders)
      .filter(([path]) => path.startsWith(`./content/${lang}/`))
      .map(async ([path, load]) => [fileName(path), await load()]),
  ).then((entries) => {
    translations[lang] = Object.fromEntries(entries);
  });

  return loading[lang];
}

const cache = new Map();

/** Дані файлу src/data/<name>.js мовою lang */
export function getData(name, lang) {
  const base = baseData[name];

  if (!base) {
    throw new Error(`[i18n] Немає файлу src/data/${name}.js`);
  }

  const override = translations[lang]?.[name];

  if (lang === DEFAULT_LANGUAGE || !override) return base;

  const cacheKey = `${lang}:${name}`;

  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, mergeTranslation({ ...base }, { ...override }));
  }

  return cache.get(cacheKey);
}
