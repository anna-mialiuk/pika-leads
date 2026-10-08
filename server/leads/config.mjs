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
