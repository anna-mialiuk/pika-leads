/**
 * Генерує public/sitemap.xml (з hreflang для uk/ru/en) і public/robots.txt.
 * Запускається автоматично перед `npm run build`, вручну — `npm run sitemap`.
 * Домен береться з VITE_SITE_URL (або .env) — так само, як у src/i18n/seoConfig.js.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv(process.env.NODE_ENV || "production", root, "VITE_");
const SITE_URL = (
  process.env.VITE_SITE_URL ||
  env.VITE_SITE_URL ||
  "https://pika-leads.com"
).replace(/\/$/, "");

const server = await createServer({
  root,
  logLevel: "silent",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const load = (file) => server.ssrLoadModule(file);

  const { LANGUAGES, DEFAULT_LANGUAGE } = await load("/src/i18n/config.js");
  const { localizePath } = await load("/src/i18n/paths.js");
  const { services } = await load("/src/data/servicesData.js");
  const { servicePages } = await load("/src/data/servicePagesData.js");
  const { cases } = await load("/src/data/casesData.js");
  // чернетки (status: "draft") у sitemap не потрапляють
  const isPublished = (item) => (item.status ?? "published") === "published";
  const publicCases = cases.filter(
    (caseItem) => caseItem.image && isPublished(caseItem),
  );
  const { blogArticles } = await load("/src/data/blogData.js");

  const pages = [
    { path: "/", priority: "1.0" },
    { path: "/cases", priority: "0.8" },
    { path: "/blog", priority: "0.8" },
    { path: "/team", priority: "0.5" },
    { path: "/contacts", priority: "0.6" },
    ...[
      "/privacy-policy",
      "/cookies-policy",
      "/disclaimer",
      "/personal-data",
    ].map((legalPath) => ({ path: legalPath, priority: "0.3" })),
    ...services
      .filter(({ slug }) => servicePages[slug])
      .map(({ slug }) => ({ path: `/services/${slug}`, priority: "0.9" })),
    ...publicCases.map(({ id }) => ({ path: `/cases/${id}`, priority: "0.6" })),
    ...blogArticles
      .filter(isPublished)
      .map(({ id }) => ({ path: `/blog/${id}`, priority: "0.6" })),
  ];

  // сторінки, закриті від індексації в адмінці (SEO → noindex), у sitemap не потрапляють
  const seoOverrides = JSON.parse(fs.readFileSync(path.join(root, "src/content/seo.json"), "utf8"));
  const indexable = (pagePath) => !(Object.hasOwn(seoOverrides, pagePath) && seoOverrides[pagePath]?.noindex === true);

  const url = (pagePath, code) => `${SITE_URL}${localizePath(pagePath, code)}`;

  const entries = pages.filter(({ path: pagePath }) => indexable(pagePath)).flatMap(({ path: pagePath, priority }) =>
    LANGUAGES.map(({ code }) => {
      const alternates = [
        ...LANGUAGES.map(
          (language) =>
            `    <xhtml:link rel="alternate" hreflang="${language.htmlLang}" href="${url(pagePath, language.code)}" />`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${url(pagePath, DEFAULT_LANGUAGE)}" />`,
      ].join("\n");

      return `  <url>\n    <loc>${url(pagePath, code)}</loc>\n${alternates}\n    <priority>${priority}</priority>\n  </url>`;
    }),
  );

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;

  const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.writeFileSync(path.join(root, "public", "sitemap.xml"), sitemap);
  fs.writeFileSync(path.join(root, "public", "robots.txt"), robots);

  console.log(
    `sitemap.xml: ${entries.length} URL (${pages.length} сторінок × ${LANGUAGES.length} мови), домен ${SITE_URL}`,
  );
} finally {
  await server.close();
}
