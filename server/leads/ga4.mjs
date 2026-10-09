/**
 * Google Analytics 4 Data API через сервісний акаунт (лише читання звітів).
 *
 * Налаштування (.env сервера):
 *   GA4_PROPERTY_ID=123456789                       — ID ресурсу GA4 (Адміністратор → Відомості про ресурс)
 *   GA4_SERVICE_ACCOUNT_FILE=/home/deploy/ga4-key.json — JSON-ключ сервісного акаунта (поза репозиторієм)
 * Email сервісного акаунта додається в GA4 як «Глядач».
 *
 * Токен доступу — JWT, підписаний ключем акаунта (RS256), обмінюється на access_token на годину.
 * Звіти кешуються на 10 хвилин, щоб не впиратися в квоти.
 */
import crypto from "node:crypto";
import fs from "node:fs";

import { GA4_DATA_API_URL, GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_FILE, GOOGLE_OAUTH_URL } from "./config.mjs";
import { HttpError } from "./http.mjs";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const CACHE_MS = 10 * 60_000;

let account = null; // { client_email, private_key }
let accountError = "";

function loadAccount() {
  if (account || !GA4_SERVICE_ACCOUNT_FILE) return account;
  try {
    const json = JSON.parse(fs.readFileSync(GA4_SERVICE_ACCOUNT_FILE, "utf8"));
    if (!json.client_email || !json.private_key) throw new Error("в файле нет client_email / private_key");
    account = { client_email: json.client_email, private_key: json.private_key };
    accountError = "";
  } catch (error) {
    accountError = `Ключ сервисного аккаунта не прочитан: ${error.message}`;
  }
  return account;
}

export const ga4Ready = () => Boolean(GA4_PROPERTY_ID && loadAccount());

export function ga4Status() {
  loadAccount();
  return {
    configured: ga4Ready(),
    propertyId: GA4_PROPERTY_ID || "",
    email: account?.client_email || "",
    error: accountError || (GA4_PROPERTY_ID ? "" : GA4_SERVICE_ACCOUNT_FILE ? "Не указан GA4_PROPERTY_ID" : ""),
    lastError: lastError,
    syncedAt: lastSync,
  };
}

let lastError = "";
let lastSync = null;

// ---------- access token ----------
let token = null; // { value, exp }

const b64url = (input) => Buffer.from(input).toString("base64url");

async function accessToken() {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const acc = loadAccount();
  if (!acc) throw new HttpError(400, "Google Analytics не подключён");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: acc.client_email, scope: SCOPE, aud: GOOGLE_OAUTH_URL, iat: now, exp: now + 3600 }));
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${head}.${claim}`), acc.private_key).toString("base64url");
  const response = await fetch(GOOGLE_OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${signature}` }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new HttpError(502, `Google отклонил ключ: ${body.error_description || body.error || response.status}`);
  }
  token = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return token.value;
}

async function gaCall(method, payload) {
  const response = await fetch(`${GA4_DATA_API_URL}/v1beta/properties/${GA4_PROPERTY_ID}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error?.message || `HTTP ${response.status}`;
    lastError = message;
    if (response.status === 403) throw new HttpError(502, `Нет доступа к ресурсу GA4 — добавьте сервисный аккаунт как «Читатель». ${message}`);
    throw new HttpError(502, `Ошибка Google Analytics: ${message}`);
  }
  lastError = "";
  return body;
}

// ---------- розбір відповіді ----------
/** Рядки звіту → [{ dim1, dim2, metric1… }] за назвами з запиту */
function rowsOf(report, dims, metrics) {
  return (report.rows || []).map((row) => {
    const out = {};
    dims.forEach((d, i) => {
      out[d] = row.dimensionValues?.[i]?.value ?? "";
    });
    metrics.forEach((m, i) => {
      out[m] = Number(row.metricValues?.[i]?.value ?? 0);
    });
    return out;
  });
}

const report = (dims, metrics, extra = {}) => ({
  dimensions: dims.map((name) => ({ name })),
  metrics: metrics.map((name) => ({ name })),
  ...extra,
});

const cache = new Map();

async function cached(key, load, ttl = CACHE_MS) {
  const hit = cache.get(key);
  if (hit && hit.at > Date.now() - ttl) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  lastSync = new Date().toISOString();
  return value;
}

const dateRange = (days) => ({ startDate: `${days}daysAgo`, endDate: "today" });
const prevRange = (days) => ({ startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo` });

const DAYS = { "7d": 7, "28d": 28, "30d": 30, "90d": 90 };

/** Повний набір для вкладки GA4 і блоків «Сквозной» */
export async function ga4Overview(period = "28d") {
  if (!ga4Ready()) throw new HttpError(400, "Google Analytics не подключён");
  // period — "28d" або { from, to } (YYYY-MM-DD)
  const custom = typeof period === "object" && period ? period : null;
  const days = custom ? Math.round((Date.parse(custom.to) - Date.parse(custom.from)) / 86_400_000) + 1 : DAYS[period] || 28;
  const curRange = custom ? { startDate: custom.from, endDate: custom.to } : dateRange(days);
  const prevRangeOf = custom
    ? { startDate: new Date(Date.parse(custom.from) - days * 86_400_000).toISOString().slice(0, 10), endDate: new Date(Date.parse(custom.from) - 86_400_000).toISOString().slice(0, 10) }
    : prevRange(days);
  return cached(`overview:${custom ? `${custom.from}:${custom.to}` : days}`, async () => {
    const range = [curRange];
    const KPI = ["totalUsers", "newUsers", "sessions", "screenPageViews", "bounceRate", "engagementRate", "averageSessionDuration", "keyEvents", "screenPageViewsPerSession"];

    // batchRunReports — до 5 звітів за запит
    const [a, b, c] = await Promise.all([
      gaCall("batchRunReports", {
        requests: [
          report([], KPI, { dateRanges: [curRange, prevRangeOf] }),
          report(["date"], ["totalUsers", "sessions", "screenPageViews", "keyEvents", "advertiserAdClicks"], { dateRanges: range, orderBys: [{ dimension: { dimensionName: "date" } }] }),
          report(["sessionDefaultChannelGroup"], ["totalUsers", "sessions", "engagedSessions", "averageSessionDuration", "keyEvents"], { dateRanges: range, limit: 12 }),
          report(["deviceCategory"], ["sessions"], { dateRanges: range }),
          report(["browser"], ["sessions", "bounceRate", "keyEvents"], { dateRanges: range, limit: 8, orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
        ],
      }),
      gaCall("batchRunReports", {
        requests: [
          report(["pagePath"], ["screenPageViews", "totalUsers"], { dateRanges: range, limit: 12, orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }] }),
          report(["country"], ["totalUsers"], { dateRanges: range, limit: 10, orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }] }),
          report(["city", "region"], ["sessions"], { dateRanges: range, limit: 10, orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
          report(["userAgeBracket"], ["totalUsers"], { dateRanges: range }),
          report(["userGender"], ["totalUsers"], { dateRanges: range }),
        ],
      }),
      gaCall("batchRunReports", {
        requests: [
          report(["sessionSource", "sessionMedium"], ["totalUsers", "newUsers", "sessions", "bounceRate", "screenPageViewsPerSession", "averageSessionDuration", "keyEvents", "transactions", "totalRevenue"], {
            dateRanges: range,
            limit: 15,
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          }),
          report(["sessionGoogleAdsCampaignName"], ["advertiserAdClicks", "advertiserAdCost", "advertiserAdCostPerClick", "keyEvents"], {
            dateRanges: range,
            limit: 10,
            orderBys: [{ metric: { metricName: "advertiserAdCost" }, desc: true }],
          }),
          report(["eventName"], ["eventCount", "totalUsers", "keyEvents"], { dateRanges: range, limit: 15, orderBys: [{ metric: { metricName: "eventCount" }, desc: true }] }),
          report(["brandingInterest"], ["totalUsers"], { dateRanges: range, limit: 6, orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }] }),
          report(["landingPage"], ["sessions", "keyEvents"], { dateRanges: range, limit: 8, orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
        ],
      }).catch((error) => {
        // Google Ads/інтереси можуть бути недоступні для ресурсу — не валимо весь звіт
        console.error("[ga4] додаткові звіти:", error.message);
        return { reports: [] };
      }),
    ]);

    const [kpi, daily, channels, devices, browsers] = a.reports || [];
    const [pages, countries, cities, ages, genders] = b.reports || [];
    const [sources, adsCampaigns, events, interests, landings] = c.reports || [];

    const kpiNow = {};
    const kpiPrev = {};
    (kpi?.rows || []).forEach((row) => {
      // з двома діапазонами GA додає dimension «dateRange»
      const target = row.dimensionValues?.[0]?.value === "date_range_1" ? kpiPrev : kpiNow;
      KPI.forEach((m, i) => {
        target[m] = Number(row.metricValues?.[i]?.value ?? 0);
      });
    });

    return {
      period: days,
      currency: kpi?.metadata?.currencyCode || "USD",
      kpi: kpiNow,
      kpiPrev,
      daily: rowsOf(daily || {}, ["date"], ["totalUsers", "sessions", "screenPageViews", "keyEvents", "advertiserAdClicks"]),
      channels: rowsOf(channels || {}, ["sessionDefaultChannelGroup"], ["totalUsers", "sessions", "engagedSessions", "averageSessionDuration", "keyEvents"]),
      devices: rowsOf(devices || {}, ["deviceCategory"], ["sessions"]),
      browsers: rowsOf(browsers || {}, ["browser"], ["sessions", "bounceRate", "keyEvents"]),
      pages: rowsOf(pages || {}, ["pagePath"], ["screenPageViews", "totalUsers"]),
      countries: rowsOf(countries || {}, ["country"], ["totalUsers"]),
      cities: rowsOf(cities || {}, ["city", "region"], ["sessions"]),
      ages: rowsOf(ages || {}, ["userAgeBracket"], ["totalUsers"]),
      genders: rowsOf(genders || {}, ["userGender"], ["totalUsers"]),
      sources: rowsOf(sources || {}, ["sessionSource", "sessionMedium"], ["totalUsers", "newUsers", "sessions", "bounceRate", "screenPageViewsPerSession", "averageSessionDuration", "keyEvents", "transactions", "totalRevenue"]),
      adsCampaigns: rowsOf(adsCampaigns || {}, ["sessionGoogleAdsCampaignName"], ["advertiserAdClicks", "advertiserAdCost", "advertiserAdCostPerClick", "keyEvents"]),
      events: rowsOf(events || {}, ["eventName"], ["eventCount", "totalUsers", "keyEvents"]),
      interests: rowsOf(interests || {}, ["brandingInterest"], ["totalUsers"]),
      landings: rowsOf(landings || {}, ["landingPage"], ["sessions", "keyEvents"]),
      syncedAt: new Date().toISOString(),
    };
  });
}

/** Користувачі за останні 30 хвилин (по хвилинах) */
export async function ga4Realtime() {
  if (!ga4Ready()) throw new HttpError(400, "Google Analytics не подключён");
  return cached("realtime", async () => {
    const body = await gaCall("runRealtimeReport", report(["minutesAgo"], ["activeUsers"], { limit: 30 }));
    const rows = rowsOf(body, ["minutesAgo"], ["activeUsers"]);
    const perMinute = Array.from({ length: 30 }, (_, i) => rows.find((r) => Number(r.minutesAgo) === 29 - i)?.activeUsers || 0);
    return { total: rows.reduce((sum, r) => sum + r.activeUsers, 0), perMinute };
  }, 60_000);
}

/** Перевірка підключення (кнопка в адмінці) — скидає кеш */
export async function ga4Check() {
  cache.clear();
  token = null;
  account = null;
  if (!ga4Ready()) return ga4Status();
  try {
    await gaCall("runReport", report([], ["totalUsers"], { dateRanges: [dateRange(7)] }));
  } catch (error) {
    lastError = error.message;
  }
  return ga4Status();
}
