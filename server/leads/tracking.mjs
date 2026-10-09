/**
 * Серверні події реклами й аналітики:
 *   Meta Conversions API — Lead при заявці (разом із пікселем на сайті, дедуплікація за event_id)
 *                          + події за статусами CRM (напр. «Продажа» → Purchase із сумою угоди);
 *   GA4 Measurement Protocol — події за статусами CRM (qualify_lead, purchase…).
 *
 * Що відправляти на який статус — налаштовується в адмінці (Интеграции), зберігається в settings.json.
 * Кожна відправка записується в історію заявки (lead.events) — видно в картці заявки.
 */
import crypto from "node:crypto";

import { GA4_API_SECRET, GA4_API_URL, GA4_MEASUREMENT_ID, META_API_URL, META_API_VERSION, META_CAPI_TOKEN, META_PIXEL_ID, SITE_URL } from "./config.mjs";
import { readJson, writeJson } from "./store.mjs";

// ---------- налаштування ----------
const SETTINGS_FILE = "settings.json";

export const META_EVENTS = ["Lead", "Contact", "Schedule", "SubmitApplication", "CompleteRegistration", "Purchase"];
export const GA4_EVENTS = ["working_lead", "qualify_lead", "disqualify_lead", "close_convert_lead", "close_unconvert_lead", "purchase"];

const DEFAULT_TRACKING = {
  currency: "USD",
  requireConsent: true,
  testEventCode: "",
  rules: {
    scheduled: { meta: "Schedule", ga4: "working_lead" },
    qualified: { meta: "QualifiedLead", ga4: "qualify_lead" },
    unqualified: { meta: "", ga4: "disqualify_lead" },
    refused: { meta: "", ga4: "close_unconvert_lead" },
    sale: { meta: "Purchase", ga4: "purchase" },
  },
};

export function getTracking() {
  const stored = readJson(SETTINGS_FILE, {}).tracking || {};
  return { ...DEFAULT_TRACKING, ...stored, rules: { ...DEFAULT_TRACKING.rules, ...(stored.rules || {}) } };
}

export function saveTracking(tracking) {
  const settings = readJson(SETTINGS_FILE, {});
  writeJson(SETTINGS_FILE, { ...settings, tracking });
  return getTracking();
}

export const metaConfigured = () => Boolean(META_PIXEL_ID && META_CAPI_TOKEN);
export const ga4Configured = () => Boolean(GA4_MEASUREMENT_ID && GA4_API_SECRET);

// ---------- дані користувача (Meta просить SHA-256 від нормалізованих значень) ----------
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

function metaUserData(lead) {
  const data = lead.data || {};
  const t = lead.tracking || {};
  const user = {};
  const email = String(data.email || "").trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) user.em = [sha(email)];
  const phone = String(data.phone_full || "").replace(/\D/g, "");
  if (phone.length >= 8) user.ph = [sha(phone)];
  const firstName = String(data.name || "").trim().toLowerCase().split(/\s+/)[0];
  if (firstName && /\p{L}/u.test(firstName)) user.fn = [sha(firstName)];
  user.external_id = [sha(`pikaleads-${lead.id}`)];
  if (lead.ip) user.client_ip_address = lead.ip;
  if (t.userAgent) user.client_user_agent = t.userAgent;
  if (t.fbp) user.fbp = t.fbp;
  if (t.fbc) user.fbc = t.fbc;
  return user;
}

// ---------- відправка ----------
async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* GA4 відповідає порожнім тілом */
  }
  if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
  return data;
}

async function sendMeta(lead, { event, eventId, actionSource, value, currency, eventTime }) {
  const settings = getTracking();
  const body = {
    data: [
      {
        event_name: event,
        event_time: Math.floor((eventTime || Date.now()) / 1000),
        event_id: eventId,
        action_source: actionSource,
        ...(actionSource === "website" ? { event_source_url: `${SITE_URL}${lead.page || "/"}` } : {}),
        user_data: metaUserData(lead),
        custom_data: {
          lead_type: lead.type,
          ...(value !== undefined ? { value, currency } : {}),
        },
      },
    ],
    ...(settings.testEventCode ? { test_event_code: settings.testEventCode } : {}),
  };
  const url = `${META_API_URL}/${META_API_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_TOKEN)}`;
  const result = await postJson(url, body);
  if (!result?.events_received) throw new Error("Meta не приняла событие");
}

async function sendGa4(lead, { event, value, currency }) {
  const t = lead.tracking || {};
  const params = {
    engagement_time_msec: 1,
    lead_type: lead.type,
    ...(t.gaSessionId ? { session_id: t.gaSessionId } : {}),
    ...(value !== undefined ? { value, currency } : {}),
    ...(event === "purchase" ? { transaction_id: `lead-${lead.id}` } : {}),
  };
  const url = `${GA4_API_URL}/mp/collect?measurement_id=${encodeURIComponent(GA4_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(GA4_API_SECRET)}`;
  await postJson(url, { client_id: t.gaClientId, events: [{ name: event, params }] });
}

// ---------- журнал у заявці ----------
let leadsCollection = null;
/** leads.mjs передає свою колекцію (уникаємо циклічного імпорту) */
export const attachLeads = (collection) => {
  leadsCollection = collection;
};

const already = (lead, platform, event) => (lead.events || []).some((e) => e.platform === platform && e.event === event && (e.ok || e.skipped));

function log(leadId, entry) {
  leadsCollection?.update(leadId, (l) => {
    l.events = l.events || [];
    l.events.push({ at: new Date().toISOString(), ...entry });
    if (l.events.length > 50) l.events = l.events.slice(-50);
  });
}

async function attempt(lead, platform, event, send) {
  try {
    await send();
    log(lead.id, { platform, event, ok: true });
  } catch (error) {
    log(lead.id, { platform, event, ok: false, error: String(error.message).slice(0, 300) });
    console.error(`[tracking] ${platform} ${event} (заявка #${lead.id}):`, error.message);
  }
}

const consentOk = (lead, kind, settings) => !settings.requireConsent || lead.tracking?.consent?.[kind] === true;

// ---------- події ----------

/** Нова заявка з сайту → Meta Lead (піксель на сайті шле таку саму з тим же event_id); повідомлення в чаті → Contact */
export async function trackNewLead(lead) {
  if (!metaConfigured() || lead.type === "manual" || !lead.tracking?.eventId) return;
  const event = lead.type === "chat-message" ? "Contact" : "Lead";
  const settings = getTracking();
  if (!consentOk(lead, "marketing", settings)) {
    log(lead.id, { platform: "meta", event, skipped: "нет согласия на маркетинговые cookie" });
    return;
  }
  await attempt(lead, "meta", event, () =>
    sendMeta(lead, { event, eventId: lead.tracking.eventId, actionSource: "website", eventTime: Date.parse(lead.createdAt) }),
  );
}

/**
 * Статус змінився (CRM або кнопка в Telegram) → події за правилами з адмінки.
 * Кожна подія відправляється один раз на заявку. Purchase чекає, доки вкажуть суму угоди.
 */
export async function trackStatus(lead) {
  if (!lead || lead.type === "manual") return;
  const settings = getTracking();
  const rule = settings.rules[lead.status];
  if (!rule) return;
  const amount = Number(lead.amount) > 0 ? Number(lead.amount) : undefined;
  const tasks = [];

  if (rule.meta && metaConfigured() && !already(lead, "meta", rule.meta)) {
    const needsValue = rule.meta === "Purchase";
    if (!consentOk(lead, "marketing", settings)) {
      log(lead.id, { platform: "meta", event: rule.meta, skipped: "нет согласия на маркетинговые cookie" });
    } else if (!needsValue || amount) {
      tasks.push(
        attempt(lead, "meta", rule.meta, () =>
          sendMeta(lead, {
            event: rule.meta,
            eventId: `lead-${lead.id}-${rule.meta}`,
            actionSource: "system_generated",
            ...(amount ? { value: amount, currency: lead.currency || settings.currency } : {}),
          }),
        ),
      );
    }
  }

  if (rule.ga4 && ga4Configured() && !already(lead, "ga4", rule.ga4)) {
    const needsValue = rule.ga4 === "purchase";
    if (!lead.tracking?.gaClientId) {
      log(lead.id, { platform: "ga4", event: rule.ga4, skipped: "нет client_id Google Analytics (cookie не разрешены)" });
    } else if (!needsValue || amount) {
      tasks.push(
        attempt(lead, "ga4", rule.ga4, () =>
          sendGa4(lead, { event: rule.ga4, ...(amount ? { value: amount, currency: lead.currency || settings.currency } : {}) }),
        ),
      );
    }
  }
  await Promise.all(tasks);
}

/** Що чекає суми угоди (для підказки в картці) */
export function pendingValue(lead) {
  const rule = getTracking().rules[lead.status];
  if (!rule || Number(lead.amount) > 0) return false;
  return (rule.meta === "Purchase" && metaConfigured()) || (rule.ga4 === "purchase" && ga4Configured());
}

export function trackingInfo() {
  return {
    meta: { configured: metaConfigured(), pixelId: META_PIXEL_ID || null },
    ga4: { configured: ga4Configured(), measurementId: GA4_MEASUREMENT_ID || null },
    settings: getTracking(),
    metaEvents: META_EVENTS,
    ga4Events: GA4_EVENTS,
  };
}
