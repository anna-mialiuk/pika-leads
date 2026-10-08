import { createContext } from "react";

/** Під час пререндеру: { collect(seo) } — збирає SEO-теги сторінки. У браузері — null */
export const SsrHeadContext = createContext(null);
