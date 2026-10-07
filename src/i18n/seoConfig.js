/**
 * SEO-налаштування мовних версій.
 * SITE_URL — продакшн-домен без слеша в кінці. Можна перевизначити
 * змінною оточення VITE_SITE_URL (наприклад, у .env.production).
 */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://pika-leads.com"
).replace(/\/$/, "");

export const SITE_NAME = "Pika Leads";

/** Локалі для og:locale */
export const OG_LOCALES = {
  uk: "uk_UA",
  ru: "ru_RU",
  en: "en_GB",
};

export const absoluteUrl = (path = "/") =>
  /^https?:\/\//.test(path)
    ? path
    : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
