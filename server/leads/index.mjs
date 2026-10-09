/**
 * Pika Leads — приймач заявок із сайту + API адмінки.
 *
 * POST /api/leads        — заявка з форм сайту (src/services/leads.js)
 *   → перевірка й антиспам → CRM (leads.json) + журнал leads.jsonl → Telegram
 * /api/admin/*           — адмінка app.pika-leads.com (див. admin.mjs)
 *
 * Без npm-залежностей, Node 18+. Налаштування — .env (див. .env.example).
 * Перший адміністратор: node cli.mjs create-user --email … --name … --role admin
 */
import http from "node:http";

import { BOT_TOKEN, POLLING, PORT } from "./config.mjs";
import { handleAdmin } from "./admin.mjs";
import { clientIp, readBody, send } from "./http.mjs";
import { createLead, handleTelegramCallback, migrateLegacyLeads } from "./leads.mjs";
import { isLeadType } from "./statuses.mjs";
import { clean, startPolling } from "./telegram.mjs";
import { handleTaskCallback, handleTelegramMessage, startReminders } from "./tasks.mjs";
import { startMeetingReminders } from "./meetings.mjs";
import { startAnalytics } from "./analytics.mjs";
import { handleShortLink } from "./links.mjs";

// ---------- антиспам: не більше N заявок з одного IP за вікно ----------
const RATE_LIMIT = 5;
const RATE_WINDOW = 10 * 60 * 1000;
const hits = new Map();

const isRateLimited = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < RATE_WINDOW);
  recent.push(now);
  // під час флуду не накопичуємо зайвого
  hits.set(ip, recent.slice(-(RATE_LIMIT + 1)));
  return recent.length > RATE_LIMIT;
};

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    if (times.every((time) => now - time >= RATE_WINDOW)) hits.delete(ip);
  }
}, RATE_WINDOW).unref();

// ---------- перевірка заявки з сайту ----------
function validate(lead) {
  if (!lead || typeof lead !== "object") return "Некоректні дані";
  if (!isLeadType(lead.type) || lead.type === "manual") return "Невідомий тип заявки";

  const data = lead.data || {};
  // honeypot: приховане поле, яке люди не заповнюють
  if (clean(data.website)) return "spam";

  const phoneDigits = clean(data.phone_full || data.phone).replace(/\D/g, "");
  const hasContact =
    phoneDigits.length >= 7 || clean(data.email) || clean(data.telegram) || clean(data.messenger);

  if (lead.type === "chat-message") return clean(data.message) ? null : "Порожнє повідомлення";
  return hasContact ? null : "Немає контактних даних";
}

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype", "website"]);
const plainObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

/** Сторінка сайту: лише локальний шлях («/…», не «//…») */
const safePage = (page) => {
  const value = clean(page, 300);
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "";
};

/** Дані для реклами: лише значення очікуваного формату */
function sanitizeTracking(lead) {
  const t = plainObject(lead.tracking);
  const pick = (value, pattern, max) => {
    const text = clean(value, max);
    return pattern.test(text) ? text : undefined;
  };
  const consent = plainObject(t.consent);
  const result = {
    eventId: pick(t.eventId, /^[\w-]{8,64}$/, 64),
    fbp: pick(t.fbp, /^fb\.\d\.\d+\.\d+$/, 100),
    fbc: pick(t.fbc, /^fb\.\d\.\d+\.[\w-]+$/, 400),
    gaClientId: pick(t.gaClientId, /^\d+\.\d+$/, 60),
    gaSessionId: pick(t.gaSessionId, /^\d+$/, 30),
    consent: { analytics: consent.analytics === true, marketing: consent.marketing === true },
  };
  for (const key of Object.keys(result)) if (result[key] === undefined) delete result[key];
  return result;
}

/** Лише очікувані поля, обрізані за довжиною */
function sanitize(lead) {
  const data = {};
  for (const [rawKey, value] of Object.entries(plainObject(lead.data))) {
    const key = clean(rawKey, 40);
    if (UNSAFE_KEYS.has(key) || value === null || (typeof value === "object" && !Array.isArray(value))) continue;
    data[key] = Array.isArray(value)
      ? value.slice(0, 20).map((v) => clean(v, 100))
      : clean(value, key === "message" ? 4000 : 300);
  }
  const attribution = {};
  for (const [rawKey, value] of Object.entries(plainObject(lead.attribution))) {
    const key = clean(rawKey, 40);
    if (UNSAFE_KEYS.has(key) || (value && typeof value === "object")) continue;
    attribution[key] = clean(value, 500);
  }
  return {
    type: lead.type,
    tracking: sanitizeTracking(lead),
    source: clean(lead.source, 60),
    page: safePage(lead.page),
    lang: clean(lead.lang, 10),
    title: clean(lead.title, 300),
    data,
    attribution,
  };
}

async function handlePublicLead(req, res) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) return send(res, 429, { error: "Забагато заявок, спробуйте пізніше" });

  let lead;
  try {
    lead = await readBody(req);
  } catch (error) {
    return send(res, error.status || 400, { error: error.message });
  }

  const error = validate(lead);
  // на спам відповідаємо «успіхом», щоб бот не підбирав обхід
  if (error === "spam") return send(res, 200, { ok: true });
  if (error) return send(res, 400, { error });

  try {
    const record = sanitize(lead);
    record.tracking.userAgent = String(req.headers["user-agent"] || "").slice(0, 400);
    await createLead(record, { ip });
  } catch (createError) {
    console.error("[leads] не вдалося зберегти заявку:", createError);
  }
  return send(res, 200, { ok: true });
}

const server = http.createServer((req, res) => {
  const pathname = req.url.split("?")[0];

  if (pathname.startsWith("/api/admin/")) return handleAdmin(req, res);
  if (req.method === "GET" && pathname === "/api/leads/health") return send(res, 200, { ok: true });
  if (req.method === "POST" && pathname === "/api/leads") return handlePublicLead(req, res);
  // короткі посилання з UTM-конструктора (Nginx сайту проксіює /go/)
  if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/go/")) return handleShortLink(req, res);

  return send(res, 404, { error: "Not found" });
});

migrateLegacyLeads();

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[leads] слушаю http://127.0.0.1:${PORT} (/api/leads, /api/admin)`);
  if (BOT_TOKEN && POLLING) {
    startPolling(
      (query) => (String(query.data || "").startsWith("task:") ? handleTaskCallback(query) : handleTelegramCallback(query)),
      handleTelegramMessage,
    );
  }
  startReminders();
  startMeetingReminders();
  startAnalytics();
});
