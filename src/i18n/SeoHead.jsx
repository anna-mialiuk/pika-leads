import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { LANGUAGES, DEFAULT_LANGUAGE } from "./config";
import { localizePath, stripLanguagePrefix } from "./paths";
import { OG_LOCALES, SITE_NAME, absoluteUrl } from "./seoConfig.js";
import { useLanguage } from "./useLanguage";

import defaultImage from "../assets/images/pika-hero.webp";

const MANAGED = "data-seo";

/** Створює або оновлює <meta>/<link> у <head> */
function upsert(tag, selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement(tag);
    element.setAttribute(MANAGED, "");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) =>
    element.setAttribute(name, value),
  );
}

/**
 * Мета-теги сторінки для поточної мови:
 * title, description, canonical, hreflang (uk/ru/en + x-default), Open Graph, Twitter.
 * Використання: <Seo title="..." description="..." image={img} type="article" />
 */
function SeoHead({
  title,
  description,
  image,
  type = "website",
  noindex = false,
}) {
  const { lang } = useLanguage();
  const { pathname } = useLocation();

  useEffect(() => {
    const basePath = stripLanguagePrefix(pathname);
    const canonical = absoluteUrl(localizePath(basePath, lang));
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const imageUrl = absoluteUrl(image || defaultImage);

    document.title = fullTitle;

    upsert("meta", 'meta[name="description"]', {
      name: "description",
      content: description || "",
    });

    upsert("meta", 'meta[name="robots"]', {
      name: "robots",
      content: noindex ? "noindex, nofollow" : "index, follow",
    });

    upsert("link", 'link[rel="canonical"]', {
      rel: "canonical",
      href: canonical,
    });

    // hreflang: та сама сторінка всіма мовами + x-default (українська)
    document.head
      .querySelectorAll(`link[rel="alternate"][hreflang][${MANAGED}]`)
      .forEach((link) => link.remove());

    [
      ...LANGUAGES.map(({ code, htmlLang }) => [htmlLang, code]),
      ["x-default", DEFAULT_LANGUAGE],
    ].forEach(([hreflang, code]) => {
      const link = document.createElement("link");
      link.setAttribute(MANAGED, "");
      link.rel = "alternate";
      link.hreflang = hreflang;
      link.href = absoluteUrl(localizePath(basePath, code));
      document.head.appendChild(link);
    });

    const og = {
      "og:site_name": SITE_NAME,
      "og:type": type,
      "og:title": fullTitle,
      "og:description": description || "",
      "og:url": canonical,
      "og:image": imageUrl,
      "og:locale": OG_LOCALES[lang],
    };

    Object.entries(og).forEach(([property, content]) =>
      upsert("meta", `meta[property="${property}"]`, { property, content }),
    );

    document.head
      .querySelectorAll(`meta[property="og:locale:alternate"][${MANAGED}]`)
      .forEach((meta) => meta.remove());

    LANGUAGES.filter(({ code }) => code !== lang).forEach(({ code }) => {
      const meta = document.createElement("meta");
      meta.setAttribute(MANAGED, "");
      meta.setAttribute("property", "og:locale:alternate");
      meta.setAttribute("content", OG_LOCALES[code]);
      document.head.appendChild(meta);
    });

    const twitter = {
      "twitter:card": "summary_large_image",
      "twitter:title": fullTitle,
      "twitter:description": description || "",
      "twitter:image": imageUrl,
    };

    Object.entries(twitter).forEach(([name, content]) =>
      upsert("meta", `meta[name="${name}"]`, { name, content }),
    );
  }, [lang, pathname, title, description, image, type, noindex]);

  return null;
}

export default SeoHead;
