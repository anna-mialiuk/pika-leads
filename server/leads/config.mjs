/**
 * Налаштування приймача заявок і адмінки (змінні оточення з .env).
 */
import path from "node:path";

const env = process.env;

export const PORT = Number(env.PORT || 3010);

// Telegram
export const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || "";
export const CHAT_IDS = (env.TELEGRAM_CHAT_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
export const TELEGRAM_API = env.TELEGRAM_API_URL || "https://api.telegram.org";
export const POLLING = env.TELEGRAM_POLLING !== "0";

// Дані: резервний журнал заявок (як і раніше) + сховище адмінки поруч із ним
export const LEADS_LOG = env.LEADS_FILE || path.resolve("leads.jsonl");
export const DATA_DIR = env.DATA_DIR || path.dirname(LEADS_LOG);

// Адмінка
export const ADMIN_URL = (env.ADMIN_URL || "https://app.pika-leads.com").replace(/\/$/, "");
export const REQUIRE_2FA = env.ADMIN_REQUIRE_2FA !== "0";
export const COOKIE_SECURE = env.COOKIE_SECURE !== "0";
export const SESSION_HOURS = Number(env.SESSION_HOURS || 12);
export const REMEMBER_DAYS = Number(env.REMEMBER_DAYS || 30);
export const TOTP_ISSUER = env.TOTP_ISSUER || "Pikaleads";

// Публікація контенту сайту (кейси, блог, відгуки) — коміти в GitHub, див. github.mjs
export const GITHUB_TOKEN = env.GITHUB_TOKEN || "";
export const GITHUB_REPO = env.GITHUB_REPO || "";
export const GITHUB_BRANCH = env.GITHUB_BRANCH || "main";
export const GITHUB_API = (env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
export const GITHUB_AUTHOR_EMAIL = env.GITHUB_AUTHOR_EMAIL || "admin@pika-leads.com";
export const SITE_URL = (env.SITE_URL || "https://pika-leads.com").replace(/\/$/, "");

// Пошта (відновлення пароля): SMTP з TLS на порту 465 — див. mail.mjs
export const SMTP_HOST = env.SMTP_HOST || "";
export const SMTP_PORT = Number(env.SMTP_PORT || 465);
export const SMTP_USER = env.SMTP_USER || "";
export const SMTP_PASS = env.SMTP_PASS || "";
export const MAIL_FROM = env.MAIL_FROM || "";
export const MAIL_FROM_NAME = env.MAIL_FROM_NAME || "Pikaleads";

// Реклама й аналітика на сервері (див. tracking.mjs)
export const META_PIXEL_ID = env.META_PIXEL_ID || "";
export const META_CAPI_TOKEN = env.META_CAPI_TOKEN || "";
export const META_API_VERSION = env.META_API_VERSION || "v21.0";
export const META_API_URL = (env.META_API_URL || "https://graph.facebook.com").replace(/\/$/, "");
export const GA4_API_URL = (env.GA4_API_URL || "https://www.google-analytics.com").replace(/\/$/, "");
export const GA4_MEASUREMENT_ID = env.GA4_MEASUREMENT_ID || "";
export const GA4_API_SECRET = env.GA4_API_SECRET || "";

// Часовий пояс для нагадувань у Telegram
export const TIMEZONE = env.TIMEZONE || "Europe/Kyiv";

// ---------- аналітика (розділ «Аналитика») ----------
// GA4 Data API — сервісний акаунт Google Cloud із роллю «Глядач» у ресурсі GA4.
// Ключ (JSON) лежить на сервері поза репозиторієм, у .env — лише шлях до нього.
export const GA4_PROPERTY_ID = (env.GA4_PROPERTY_ID || "").replace(/^properties\//, "");
export const GA4_SERVICE_ACCOUNT_FILE = env.GA4_SERVICE_ACCOUNT_FILE || "";
export const GOOGLE_OAUTH_URL = env.GOOGLE_OAUTH_URL || "https://oauth2.googleapis.com/token";
export const GA4_DATA_API_URL = (env.GA4_DATA_API_URL || "https://analyticsdata.googleapis.com").replace(/\/$/, "");
// Microsoft Clarity Data Export API (10 запитів на день)
export const CLARITY_PROJECT_ID = env.CLARITY_PROJECT_ID || "";
export const CLARITY_API_TOKEN = env.CLARITY_API_TOKEN || "";
export const CLARITY_API_URL = (env.CLARITY_API_URL || "https://www.clarity.ms").replace(/\/$/, "");
// Meta Marketing API — токен системного користувача з правом ads_read
export const META_ADS_TOKEN = env.META_ADS_TOKEN || "";
// Claude API для AI-помічника байєра
export const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY || "";
export const ANTHROPIC_API_URL = (env.ANTHROPIC_API_URL || "https://api.anthropic.com").replace(/\/$/, "");
export const AI_MODEL = env.AI_MODEL || "claude-sonnet-5-5";
// Короткі посилання: https://pika-leads.com/go/<код> (Nginx сайту проксіює /go/ на цей сервіс)
export const SHORT_LINK_BASE = (env.SHORT_LINK_BASE || `${(env.SITE_URL || "https://pika-leads.com").replace(/\/$/, "")}/go`).replace(/\/$/, "");
