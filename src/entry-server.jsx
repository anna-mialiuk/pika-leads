/**
 * Пререндер: малює сторінку в HTML під час збірки (scripts/prerender.mjs).
 * Відвідувач одразу бачить готову сторінку, React потім «оживляє» її (hydrateRoot).
 */
import { StrictMode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { StaticRouter } from "react-router";

import App from "./App";
import { LANGUAGES, localizePath } from "./i18n";
import { SsrHeadContext } from "./i18n/SsrHeadContext";
import { seoToHtml } from "./i18n/seoTags";
import { getArticles, getCases, LEGAL_SLUGS } from "./content/api";
import { getData } from "./i18n/content";

export async function render(url) {
  const head = {};

  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <SsrHeadContext.Provider value={{ collect: (seo) => (head.seo = seo) }}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </SsrHeadContext.Provider>
    </StrictMode>,
  );

  let html = "";
  for await (const chunk of prelude) html += chunk;

  return { html, head: head.seo ? seoToHtml(head.seo) : "" };
}

/** Усі адреси для пререндеру: кожна сторінка × кожна мова */
export async function getRoutes() {
  const lang = LANGUAGES[0].code;
  const { servicePages } = getData("servicePagesData", lang);
  const cases = (await getCases(lang)).filter((item) => item.image);
  const articles = await getArticles(lang);

  const paths = [
    "/",
    "/cases",
    "/blog",
    "/team",
    "/contacts",
    ...Object.keys(servicePages).map((slug) => `/services/${slug}`),
    ...cases.map(({ slug }) => `/cases/${slug}`),
    ...articles.map(({ slug }) => `/blog/${slug}`),
    ...LEGAL_SLUGS.map((slug) => `/${slug}`),
  ];

  return LANGUAGES.flatMap(({ code }) =>
    paths.map((path) => ({ lang: code, url: localizePath(path, code) })),
  );
}
