import { DEFAULT_LANGUAGE } from "./config";

import uk from "./locales/uk";
import en from "./locales/en";
import ru from "./locales/ru";

const dictionaries = { uk, en, ru };

const getByPath = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object);

/**
 * Множина: { one, few, many, other } + vars.count → потрібна форма
 * (1 кейс / 3 кейси / 52 кейси — для кожної мови за правилами Intl.PluralRules).
 */
function pickPluralForm(lang, value, vars) {
  if (typeof value !== "object" || value === null || !("other" in value)) {
    return value;
  }

  const form = new Intl.PluralRules(lang).select(Number(vars?.count) || 0);

  return value[form] ?? value.other;
}

/**
 * Рядок інтерфейсу за ключем: t("header.call"), t("casesHero.badge", { count: 52 }).
 * Якщо перекладу немає — береться українська версія, потім сам ключ.
 */
export function translate(lang, key, vars) {
  const value =
    getByPath(dictionaries[lang], key) ??
    getByPath(dictionaries[DEFAULT_LANGUAGE], key) ??
    key;

  const text = pickPluralForm(lang, value, vars);

  if (!vars || typeof text !== "string") return text;

  return text.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] !== undefined ? vars[name] : match,
  );
}
