/**
 * Шар доступу до контенту (кейси, статті блогу).
 *
 * Дані — з файлів проєкту, які редагуються в адмінці (див. vite-content.js):
 *   кейси   — src/content/cases/<id>.json
 *   статті  — картки в src/content/articles/<id>.json, тексти в src/content/blog/<мова>/<id>.json
 * Компоненти працюють через хуки з ./hooks.js і нічого не знають про джерело.
 * Усі функції повертають Promise (кешований, щоб React `use()` не перезапитував).
 */
import { DEFAULT_LANGUAGE } from "../i18n/config";
import { getData } from "../i18n/content";
import { getToc } from "./toc";

const articleBodies = import.meta.glob("./blog/*/*.json");
const legalPages = import.meta.glob("./legal/*/*.json");

const cache = new Map();

/**
 * Єдина схема запису (так само зберігатиме CMS):
 *   id / slug     — адреса сторінки
 *   status        — "published" | "draft" (чернетки не показуються ніде)
 *   publishedAt   — дата публікації (YYYY-MM-DD)
 *   featured      — показувати на головній
 *   order         — порядок у списках (менше — вище)
 * Поля, яких немає у файлах, отримують значення за замовчуванням.
 */
const normalize = (item, index) => ({
  ...item,
  slug: item.slug ?? item.id,
  status: item.status ?? "published",
  publishedAt: item.publishedAt ?? item.date ?? null,
  featured: Boolean(item.featured),
  order: item.order ?? index,
});

const publishedList = (items) =>
  items
    .map(normalize)
    .filter((item) => item.status === "published")
    .sort((a, b) => a.order - b.order);

/** Спершу featured, потім решта — до потрібної кількості */
const pickFeatured = (items, limit) =>
  [
    ...items.filter((item) => item.featured),
    ...items.filter((item) => !item.featured),
  ].slice(0, limit);

/** Уже готове значення у вигляді промісу, який React `use()` читає без очікування */
const resolved = (value) => {
  const promise = Promise.resolve(value);
  promise.status = "fulfilled";
  promise.value = value;
  return promise;
};

const cached = (key, create) => {
  if (!cache.has(key)) cache.set(key, create());
  return cache.get(key);
};

// ---------- Кейси ----------

const casesList = (lang) => publishedList(getData("casesData", lang).cases);

export const getCases = (lang) =>
  cached(`cases:${lang}`, () => resolved(casesList(lang)));

export const getFeaturedCases = (lang, limit = 3) =>
  cached(`cases-featured:${lang}:${limit}`, () =>
    resolved(pickFeatured(casesList(lang), limit)),
  );

export const getCase = (slug, lang) =>
  cached(`case:${lang}:${slug}`, () =>
    resolved(casesList(lang).find((item) => item.slug === slug) ?? null),
  );

// ---------- Блог ----------

const articlesList = (lang) =>
  publishedList(getData("blogData", lang).blogArticles);

export const getArticles = (lang) =>
  cached(`articles:${lang}`, () => resolved(articlesList(lang)));

export const getFeaturedArticles = (lang, limit = 3) =>
  cached(`articles-featured:${lang}:${limit}`, () =>
    resolved(pickFeatured(articlesList(lang), limit)),
  );

const loadBody = async (slug, lang) => {
  const load = articleBodies[`./blog/${lang}/${slug}.json`];
  if (!load) return null;
  const module = await load();
  return module.default ?? module;
};

/** Стаття з текстом. Якщо перекладу немає — український текст і isFallback: true */
export const getArticle = (slug, lang) =>
  cached(`article:${lang}:${slug}`, async () => {
    const meta = articlesList(lang).find((item) => item.slug === slug);
    if (!meta) return null;

    let body = await loadBody(slug, lang);
    const isFallback = !body && lang !== DEFAULT_LANGUAGE;
    if (!body) body = await loadBody(slug, DEFAULT_LANGUAGE);

    const blocks = body?.blocks ?? [];

    return { ...meta, blocks, toc: getToc(blocks), isFallback };
  });

// ---------- Юридичні сторінки ----------

/** Слаги юридичних документів (порядок — як у футері) */
export const LEGAL_SLUGS = [
  "privacy-policy",
  "cookies-policy",
  "disclaimer",
  "personal-data",
];

const loadLegal = async (slug, lang) => {
  const load = legalPages[`./legal/${lang}/${slug}.json`];
  if (!load) return null;
  const module = await load();
  return module.default ?? module;
};

/** Юридична сторінка: { title, description, updatedAt, blocks, toc, isFallback } */
export const getLegalPage = (slug, lang) =>
  cached(`legal:${lang}:${slug}`, async () => {
    let page = await loadLegal(slug, lang);
    const isFallback = !page && lang !== DEFAULT_LANGUAGE;
    if (!page) page = await loadLegal(slug, DEFAULT_LANGUAGE);
    if (!page) return null;

    return { ...page, toc: getToc(page.blocks), isFallback };
  });
