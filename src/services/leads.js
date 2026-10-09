/**
 * Єдина відправка заявок з усіх форм сайту.
 *
 * Куди: VITE_LEADS_ENDPOINT (.env), за замовчуванням на продакшені — /api/leads
 * (приймач server/leads → Telegram). У dev-режимі без змінної — лише в консоль.
 *
 * Що надсилається:
 *   type        — consultation | audit | question | bonus | callback | chat-message | chat-callback
 *   source      — звідки відкрили форму (hero, header, case, blog, chat…)
 *   data        — поля форми (name, phone, phone_full, telegram, niche, message…)
 *   lang, page, title, referrer
 *   attribution — utm_*, gclid, fbclid, ttclid і сторінка входу (перший візит у сесії)
 *   createdAt
 * Після успіху — події GA4 / Meta Pixel / dataLayer (services/tracking.js).
 */
import { trackLead, trackingData } from "./tracking";

// На продакшені за замовчуванням — власний приймач на тому ж домені (server/leads)
const ENDPOINT =
  import.meta.env.VITE_LEADS_ENDPOINT ||
  (import.meta.env.PROD ? "/api/leads" : "");
const ATTRIBUTION_KEY = "pika-attribution";
const TRACKED_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "gclid",
  "fbclid",
  "ttclid",
  // параметри Meta з URL оголошення: ?campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}
  "campaign_id",
  "adset_id",
  "ad_id",
  "placement",
];

const readStorage = () => {
  try {
    return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY)) ?? null;
  } catch {
    return null;
  }
};

/** Запам'ятовує UTM-мітки та сторінку входу (викликається один раз при старті) */
export function captureAttribution() {
  if (typeof window === "undefined" || readStorage()) return;

  const params = new URLSearchParams(window.location.search);
  const attribution = {
    landingPage: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
  };

  TRACKED_PARAMS.forEach((key) => {
    const value = params.get(key);
    if (value) attribution[key] = value;
  });

  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    /* приватний режим — працюємо без збереження */
  }
}

/** Поля форми → об'єкт; кілька значень з одним name (чекбокси) → масив */
export function formToObject(form) {
  const data = {};

  new FormData(form).forEach((value, key) => {
    if (key in data) data[key] = [].concat(data[key], value);
    else data[key] = value;
  });

  return data;
}

export async function sendLead({ type, source = "", data = {} }) {
  const attribution = readStorage();
  // event_id + cookie реклами: сервер відправить таку ж подію через Meta Conversions API
  const tracking = trackingData(attribution);
  const payload = {
    type,
    source,
    data,
    lang: document.documentElement.lang,
    page: window.location.pathname,
    title: document.title,
    attribution,
    tracking,
    createdAt: new Date().toISOString(),
  };

  if (ENDPOINT) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok)
      throw new Error(`Lead request failed: ${response.status}`);
  } else if (import.meta.env.DEV) {
    console.info("[lead] VITE_LEADS_ENDPOINT не задано, заявка:", payload);
  }

  trackLead({ type, source, eventId: tracking.eventId });

  return payload;
}
