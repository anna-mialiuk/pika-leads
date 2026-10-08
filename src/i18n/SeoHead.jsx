import { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";

import { buildSeo } from "./seoTags";
import { SsrHeadContext } from "./SsrHeadContext";
import { useLanguage } from "./useLanguage";

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

/** Перестворює групу повторюваних тегів (hreflang, og:locale:alternate) */
function replaceAll(selector, tag, attributesList) {
  document.head
    .querySelectorAll(`${selector}[${MANAGED}]`)
    .forEach((element) => element.remove());

  attributesList.forEach((attributes) => {
    const element = document.createElement(tag);
    element.setAttribute(MANAGED, "");
    Object.entries(attributes).forEach(([name, value]) =>
      element.setAttribute(name, value),
    );
    document.head.appendChild(element);
  });
}

/**
 * Мета-теги сторінки для поточної мови:
 * title, description, canonical, hreflang (uk/ru/en + x-default), Open Graph, Twitter.
 * Використання: <Seo title="..." description="..." image={img} type="article" />
 * Під час пререндеру ті самі теги потрапляють у статичний HTML (scripts/prerender.mjs).
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
  const ssrHead = useContext(SsrHeadContext);

  const seo = buildSeo({
    title,
    description,
    image,
    type,
    noindex,
    lang,
    pathname,
  });

  // пререндер: передаємо теги назовні, щоб вписати їх у <head> HTML-файлу
  ssrHead?.collect(seo);

  useEffect(() => {
    document.title = seo.title;

    upsert("meta", 'meta[name="description"]', {
      name: "description",
      content: seo.description,
    });
    upsert("meta", 'meta[name="robots"]', {
      name: "robots",
      content: seo.robots,
    });
    upsert("link", 'link[rel="canonical"]', {
      rel: "canonical",
      href: seo.canonical,
    });

    replaceAll(
      'link[rel="alternate"][hreflang]',
      "link",
      seo.alternates.map(({ hreflang, href }) => ({
        rel: "alternate",
        hreflang,
        href,
      })),
    );

    Object.entries(seo.og).forEach(([property, content]) =>
      upsert("meta", `meta[property="${property}"]`, { property, content }),
    );

    replaceAll(
      'meta[property="og:locale:alternate"]',
      "meta",
      seo.ogAlternates.map((content) => ({
        property: "og:locale:alternate",
        content,
      })),
    );

    Object.entries(seo.twitter).forEach(([name, content]) =>
      upsert("meta", `meta[name="${name}"]`, { name, content }),
    );
    // seo перераховується з цих значень
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, pathname, title, description, image, type, noindex]);

  return null;
}

export default SeoHead;
