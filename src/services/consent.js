/**
 * Згода на cookie + Google Consent Mode v2 + завантаження GTM.
 *
 * Типова згода «все заборонено» задається ще в index.html (до будь-яких тегів).
 * Тут: збереження вибору користувача, оновлення Consent Mode і запуск GTM.
 *
 * Категорії (як у Політиці cookie):
 *   necessary  — завжди увімкнені (робота сайту, збереження самої згоди)
 *   functional — запам'ятовування вибору (functionality_storage, personalization_storage)
 *   analytics  — GA4 тощо (analytics_storage)
 *   marketing  — Meta Pixel, Google Ads, TikTok… (ad_storage, ad_user_data, ad_personalization)
 */
import { GTM_ID } from "../config/analytics";

export const CONSENT_KEY = "pika-consent";
// підвищіть версію, якщо зміниться склад категорій — банер покажеться знову
export const CONSENT_VERSION = 1;
export const OPEN_SETTINGS_EVENT = "pika:cookie-settings";

const listeners = new Set();

export function getConsent() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY));
    return stored?.version === CONSENT_VERSION ? stored : null;
  } catch {
    return null;
  }
}

// GTM розуміє команди gtag лише як об'єкт arguments (масив він ігнорує)
function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

const toConsentMode = ({ functional, analytics, marketing }) => {
  const state = (value) => (value ? "granted" : "denied");

  return {
    functionality_storage: state(functional),
    personalization_storage: state(functional),
    analytics_storage: state(analytics),
    ad_storage: state(marketing),
    ad_user_data: state(marketing),
    ad_personalization: state(marketing),
  };
};

let gtmLoaded = false;

/**
 * GTM вантажимо, коли браузер вільний (не гальмує перший екран).
 * До згоди теги працюють в обмеженому режимі Consent Mode v2 (без cookie),
 * після згоди — повністю. Теги без підтримки Consent Mode (Meta Pixel, TikTok)
 * у GTM треба обмежити «Additional consent checks» → ad_storage.
 */
function loadGtm() {
  if (gtmLoaded || !GTM_ID || typeof window === "undefined") return;
  gtmLoaded = true;

  const start = () => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(script);
  };

  if ("requestIdleCallback" in window)
    window.requestIdleCallback(start, { timeout: 3000 });
  else window.setTimeout(start, 1500);
}

export function saveConsent(choice) {
  const consent = {
    version: CONSENT_VERSION,
    functional: Boolean(choice.functional),
    analytics: Boolean(choice.analytics),
    marketing: Boolean(choice.marketing),
    date: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // приватний режим — згода діє до кінця сесії
  }

  gtag("consent", "update", toConsentMode(consent));
  window.dataLayer.push({
    event: "consent_update",
    consent_functional: consent.functional,
    consent_analytics: consent.analytics,
    consent_marketing: consent.marketing,
  });

  listeners.forEach((listener) => listener(consent));

  return consent;
}

/** Запуск при старті сайту (main.jsx) */
export function initConsent() {
  loadGtm();
}

export function onConsentChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Відкрити налаштування cookie (посилання у футері) */
export function openCookieSettings() {
  // якщо банер ще не завантажився — він відкриє налаштування сам, щойно з'явиться
  window.__pikaCookieSettings = true;
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
