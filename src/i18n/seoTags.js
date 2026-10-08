import { LANGUAGES, DEFAULT_LANGUAGE } from "./config";
import { localizePath, stripLanguagePrefix } from "./paths";
import { OG_LOCALES, SITE_NAME, absoluteUrl } from "./seoConfig.js";

/** Картинка для прев'ю посилань (Telegram, Facebook, Viber…) — 1200×630, своя для кожної мови */
const defaultImage = (lang) => `/og/og-${lang}.jpg`;

/**
 * Усі SEO-теги сторінки одним об'єктом.
 * Використовується і в браузері (SeoHead оновлює <head>),
 * і під час пререндеру (теги вписуються в статичний HTML).
 */
export function buildSeo({
  title,
  description = "",
  image,
  type = "website",
  noindex = false,
  lang,
  pathname,
}) {
  const basePath = stripLanguagePrefix(pathname);
  const canonical = absoluteUrl(localizePath(basePath, lang));
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const imageUrl = absoluteUrl(image || defaultImage(lang || DEFAULT_LANGUAGE));
  const imageMeta = image
    ? {}
    : { "og:image:width": "1200", "og:image:height": "630", "og:image:type": "image/jpeg", "og:image:alt": fullTitle };

  return {
    title: fullTitle,
    description,
    robots: noindex ? "noindex, nofollow" : "index, follow",
    canonical,
    alternates: [
      ...LANGUAGES.map(({ code, htmlLang }) => [htmlLang, code]),
      ["x-default", DEFAULT_LANGUAGE],
    ].map(([hreflang, code]) => ({
      hreflang,
      href: absoluteUrl(localizePath(basePath, code)),
    })),
    og: {
      "og:site_name": SITE_NAME,
      "og:type": type,
      "og:title": fullTitle,
      "og:description": description,
      "og:url": canonical,
      "og:image": imageUrl,
      ...imageMeta,
      "og:locale": OG_LOCALES[lang],
    },
    ogAlternates: LANGUAGES.filter(({ code }) => code !== lang).map(
      ({ code }) => OG_LOCALES[code],
    ),
    twitter: {
      "twitter:card": "summary_large_image",
      "twitter:title": fullTitle,
      "twitter:description": description,
      "twitter:image": imageUrl,
    },
  };
}

const escape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Теги для статичного HTML (data-seo — щоб SeoHead у браузері їх підхопив) */
export function seoToHtml(seo) {
  const tags = [
    `<title>${escape(seo.title)}</title>`,
    `<meta data-seo name="description" content="${escape(seo.description)}">`,
    `<meta data-seo name="robots" content="${seo.robots}">`,
    `<link data-seo rel="canonical" href="${escape(seo.canonical)}">`,
    ...seo.alternates.map(
      ({ hreflang, href }) =>
        `<link data-seo rel="alternate" hreflang="${hreflang}" href="${escape(href)}">`,
    ),
    ...Object.entries(seo.og).map(
      ([property, content]) =>
        `<meta data-seo property="${property}" content="${escape(content)}">`,
    ),
    ...seo.ogAlternates.map(
      (content) =>
        `<meta data-seo property="og:locale:alternate" content="${escape(content)}">`,
    ),
    ...Object.entries(seo.twitter).map(
      ([name, content]) =>
        `<meta data-seo name="${name}" content="${escape(content)}">`,
    ),
  ];

  return tags.join("\n    ");
}
