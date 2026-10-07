import { use } from "react";

import { useLanguage } from "../i18n";
import {
  getArticle,
  getArticles,
  getCase,
  getCases,
  getFeaturedArticles,
  getFeaturedCases,
  getLegalPage,
} from "./api";

/** Хуки для компонентів. Джерело даних — ./api.js */

export const useCases = () => use(getCases(useLanguage().lang));

export const useCase = (slug) => use(getCase(slug, useLanguage().lang));

export const useArticles = () => use(getArticles(useLanguage().lang));

export const useArticle = (slug) => use(getArticle(slug, useLanguage().lang));

/** Для головної: спершу featured, далі решта */
export const useFeaturedCases = (limit) =>
  use(getFeaturedCases(useLanguage().lang, limit));

export const useFeaturedArticles = (limit) =>
  use(getFeaturedArticles(useLanguage().lang, limit));

export const useLegalPage = (slug) =>
  use(getLegalPage(slug, useLanguage().lang));
