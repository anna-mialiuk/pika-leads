/**
 * Експорт контенту для імпорту в майбутню CMS: `npm run export:content`
 *
 * Результат — content-export/cases.json і content-export/articles.json.
 * Кожен запис = один кейс / одна стаття з усіма мовами:
 *   {
 *     id, slug, status, publishedAt, featured, order,   ← службові поля
 *     ...спільні поля (картинки, ніша, джерело трафіку…),
 *     translations: { uk: {...}, en: {...}, ru: {...} } ← тексти, що відрізняються між мовами
 *   }
 * Для статей у translations.<мова>.blocks — текст статті в форматі блоків.
 * Шляхи до картинок — відносно кореня проєкту (src/assets/...): їх треба
 * завантажити в сховище CMS і замінити на URL.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "content-export");

const server = await createServer({
  root,
  logLevel: "silent",
  server: { middlewareMode: true },
  appType: "custom",
});

const SERVICE_FIELDS = [
  "id",
  "slug",
  "status",
  "publishedAt",
  "featured",
  "order",
];

/** Розкладає локалізовані версії запису на спільні поля й переклади */
function splitByLanguage(versions) {
  const [first] = Object.values(versions);
  const record = {};
  const translations = Object.fromEntries(
    Object.keys(versions).map((lang) => [lang, {}]),
  );

  Object.keys(first).forEach((key) => {
    const values = Object.values(versions).map((version) =>
      JSON.stringify(version[key]),
    );
    const isShared = values.every((value) => value === values[0]);

    if (isShared || SERVICE_FIELDS.includes(key)) record[key] = first[key];
    else
      Object.entries(versions).forEach(
        ([lang, version]) => (translations[lang][key] = version[key]),
      );
  });

  return { ...record, translations };
}

// картинки з import → шлях у проєкті
const assetPath = (value) =>
  typeof value === "string" && value.startsWith("/src/")
    ? value.slice(1)
    : value;

const cleanAssets = (value) => {
  if (Array.isArray(value)) return value.map(cleanAssets);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, cleanAssets(v)]),
    );
  return assetPath(value);
};

try {
  const { LANGUAGES } = await server.ssrLoadModule("/src/i18n/config.js");
  const { loadTranslations } = await server.ssrLoadModule(
    "/src/i18n/content.js",
  );
  const api = await server.ssrLoadModule("/src/content/api.js");
  const langs = LANGUAGES.map(({ code }) => code);

  for (const lang of langs) await loadTranslations(lang);

  // кейси
  const casesByLang = Object.fromEntries(
    await Promise.all(
      langs.map(async (lang) => [lang, await api.getCases(lang)]),
    ),
  );
  const cases = casesByLang[langs[0]].map((item) =>
    splitByLanguage(
      Object.fromEntries(
        langs.map((lang) => [
          lang,
          casesByLang[lang].find((c) => c.slug === item.slug),
        ]),
      ),
    ),
  );

  // статті (з текстом)
  const articleList = await api.getArticles(langs[0]);
  const articles = [];

  for (const { slug } of articleList) {
    const versions = {};
    for (const lang of langs) {
      const { toc, isFallback, ...article } = await api.getArticle(slug, lang);
      versions[lang] = isFallback ? { ...article, blocks: null } : article;
    }
    articles.push(splitByLanguage(versions));
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "cases.json"),
    JSON.stringify(cleanAssets(cases), null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, "articles.json"),
    JSON.stringify(cleanAssets(articles), null, 2),
  );

  console.log(
    `content-export/: ${cases.length} кейсів, ${articles.length} статей (${langs.join(", ")})`,
  );
} finally {
  await server.close();
}
