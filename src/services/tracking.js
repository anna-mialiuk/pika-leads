/**
 * Аналітика й реклама на сайті:
 *   Google Analytics 4 (gtag.js), Meta Pixel і Google Tag Manager — з config/analytics.js.
 *
 * Події:
 *   заявка з форми         → GA4 generate_lead (lead_type: form)     · Meta Lead
 *   «перезвоніть мені»      → GA4 generate_lead (lead_type: callback) · Meta Lead
 *   повідомлення в чаті     → GA4 chat_message                       · Meta Contact
 *   клік по телефону, email, Telegram/WhatsApp/Viber → GA4 contact (method, location) · Meta Contact
 *   соцмережі               → GA4 social_click
 *   відкрили форму / чат    → GA4 form_open / chat_open
 * Кожна подія також іде в dataLayer (для тегів у GTM).
 * Meta Lead має event_id — сервер шле таку саму подію через Conversions API, Meta їх склеює.
 *
 * Згода на cookie: GA4 працює через Consent Mode (index.html, services/consent.js),
 * Meta Pixel нічого не відправляє, доки немає згоди на маркетингові cookie.
 * Скрипти вантажаться після першої дії користувача або через 4 с — щоб не гальмувати перший екран.
 */
import { GA4_ID, GTM_ID, META_PIXEL_ID } from "../config/analytics";
import { getConsent, onConsentChange } from "./consent";

const isBrowser = typeof window !== "undefined";

// gtag розуміє лише об'єкт arguments
function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

const dataLayerPush = (payload) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
};

const addScript = (src) => {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
};

/** Черга Meta Pixel (стандартний код fbq без вставки в HTML) */
function setupPixel() {
  if (window.fbq) return;
  // як в офіційному коді пікселя: у черзі — об'єкти arguments
  const fbq = function () {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
    else fbq.queue.push(arguments);
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
}

const pixel = (...args) => {
  if (META_PIXEL_ID && window.fbq) window.fbq(...args);
};

let started = false;

function loadScripts() {
  if (started) return;
  started = true;

  if (GTM_ID) {
    dataLayerPush({ "gtm.start": Date.now(), event: "gtm.js" });
    addScript(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`);
  }
  if (GA4_ID) {
    addScript(`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`);
  }
  if (META_PIXEL_ID) addScript("https://connect.facebook.net/en_US/fbevents.js");
}

export function initTracking() {
  if (!isBrowser) return;

  // черги команд створюємо одразу — події до завантаження скриптів не губляться
  if (GA4_ID) {
    gtag("js", new Date());
    gtag("config", GA4_ID);
  }
  if (META_PIXEL_ID) {
    setupPixel();
    pixel("consent", getConsent()?.marketing ? "grant" : "revoke");
    pixel("init", META_PIXEL_ID);
    pixel("track", "PageView");
    onConsentChange((consent) => pixel("consent", consent.marketing ? "grant" : "revoke"));
  }

  const start = () => {
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((name) => window.removeEventListener(name, start, true));
    loadScripts();
  };
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach((name) =>
    window.addEventListener(name, start, { capture: true, passive: true, once: true }),
  );
  window.setTimeout(start, 4000);

  document.addEventListener("click", onLinkClick, true);
}

/** Перехід між сторінками (SPA): GA4 рахує сам за історією браузера, Meta — тут */
let lastPath = isBrowser ? window.location.pathname : "";
export function trackPageView(pathname) {
  if (!isBrowser || pathname === lastPath) return;
  lastPath = pathname;
  pixel("track", "PageView");
}

// ---------- дані для сервера (Conversions API, Measurement Protocol) ----------

const cookie = (name) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};

const newEventId = () =>
  window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Те, що допоможе Meta / Google зіставити заявку з кліком по рекламі */
export function trackingData(attribution) {
  const consent = getConsent();
  let fbc = cookie("_fbc");
  if (!fbc && attribution?.fbclid) fbc = `fb.1.${Date.now()}.${attribution.fbclid}`;
  const ga = cookie("_ga").split(".");
  const gaClientId = ga.length >= 4 ? `${ga[2]}.${ga[3]}` : "";
  const gaSession = GA4_ID ? cookie(`_ga_${GA4_ID.replace(/^G-/, "")}`) : "";
  const gaSessionId = /^GS\d\.\d\.s?(\d+)/.exec(gaSession)?.[1] || "";
  return {
    eventId: newEventId(),
    fbp: cookie("_fbp") || undefined,
    fbc: fbc || undefined,
    gaClientId: gaClientId || undefined,
    gaSessionId: gaSessionId || undefined,
    consent: { analytics: Boolean(consent?.analytics), marketing: Boolean(consent?.marketing) },
  };
}

// ---------- події ----------

const CALLBACK_TYPES = new Set(["callback", "chat-callback"]);

/** Після успішної відправки заявки (services/leads.js) */
export function trackLead({ type, source, eventId }) {
  if (!isBrowser) return;
  if (type === "chat-message") {
    gtag("event", "chat_message", { form_location: source });
    pixel("track", "Contact", { content_name: "chat" }, { eventID: eventId });
    dataLayerPush({ event: "chat_message", event_id: eventId });
    return;
  }
  const category = CALLBACK_TYPES.has(type) ? "callback" : "form";
  gtag("event", "generate_lead", { lead_type: category, form_type: type, form_location: source });
  pixel("track", "Lead", { content_name: type, content_category: category }, { eventID: eventId });
  dataLayerPush({ event: "lead_submit", lead_type: type, lead_category: category, lead_source: source, event_id: eventId });
}

export function trackEvent(name, params = {}) {
  if (!isBrowser) return;
  gtag("event", name, params);
  dataLayerPush({ event: name, ...params });
}

const MESSENGERS = [
  [/^tel:/i, "phone"],
  [/^mailto:/i, "email"],
  [/(^tg:|t\.me\/|telegram\.(me|org)\/)/i, "telegram"],
  [/(wa\.me\/|whatsapp\.com\/|^whatsapp:)/i, "whatsapp"],
  [/^viber:/i, "viber"],
];
const SOCIAL = [
  [/instagram\.com/i, "instagram"],
  [/(facebook\.com|fb\.com)/i, "facebook"],
  [/linkedin\.com/i, "linkedin"],
  [/(youtube\.com|youtu\.be)/i, "youtube"],
  [/tiktok\.com/i, "tiktok"],
  [/(twitter\.com|\/\/x\.com)/i, "x"],
];

const locationOf = (element) => {
  if (element.closest("header, .header")) return "header";
  if (element.closest("footer, .footer")) return "footer";
  if (element.closest(".support-widget")) return "chat";
  return "page";
};

function onLinkClick(event) {
  const link = event.target?.closest?.("a[href]");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  const where = locationOf(link);

  const messenger = MESSENGERS.find(([pattern]) => pattern.test(href));
  if (messenger) {
    const method = messenger[1];
    gtag("event", "contact", { method, location: where });
    pixel("track", "Contact", { content_name: method, content_category: where });
    dataLayerPush({ event: "contact_click", contact_method: method, contact_location: where });
    return;
  }
  const social = SOCIAL.find(([pattern]) => pattern.test(href));
  if (social) {
    gtag("event", "social_click", { network: social[1], location: where });
    dataLayerPush({ event: "social_click", social_network: social[1], social_location: where });
  }
}
