/**
 * Ідентифікатори аналітики й реклами (публічні, їх видно в коді будь-якого сайту).
 * Можна перевизначити змінними оточення VITE_GTM_ID / VITE_GA4_ID / VITE_META_PIXEL_ID.
 * Порожнє значення — відповідний скрипт не завантажується.
 *
 * Секретні ключі (токен Conversions API, API secret GA4) — лише на сервері, у .env.
 */
export const GTM_ID = import.meta.env.VITE_GTM_ID ?? "GTM-KJR4RP5K";
export const GA4_ID = import.meta.env.VITE_GA4_ID ?? "G-BS1VTVTWVC";
export const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID ?? "1616948376756750";
