import { useEffect, useState } from "react";

import { LocalizedLink, useLanguage } from "../../i18n";
import {
  OPEN_SETTINGS_EVENT,
  getConsent,
  saveConsent,
} from "../../services/consent";

import "./CookieConsent.sass";

const CATEGORIES = ["necessary", "functional", "analytics", "marketing"];
const DEFAULT_CHOICE = { functional: true, analytics: false, marketing: false };
const ALL = { functional: true, analytics: true, marketing: true };
const NONE = { functional: false, analytics: false, marketing: false };

/**
 * Банер згоди на cookie (GDPR + Google Consent Mode v2).
 * Показується, доки користувач не зробить вибір; налаштування можна
 * відкрити знову з футера («Налаштування cookie»).
 */
function CookieConsent() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(() => !getConsent());
  const [view, setView] = useState("banner");
  const [choice, setChoice] = useState(() => getConsent() || DEFAULT_CHOICE);

  useEffect(() => {
    const openSettings = () => {
      window.__pikaCookieSettings = false;
      setChoice(getConsent() || DEFAULT_CHOICE);
      setView("settings");
      setOpen(true);
    };

    // посилання у футері могли натиснути ще до завантаження банера
    if (window.__pikaCookieSettings) openSettings();

    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, []);

  if (!open) return null;

  const decide = (value) => {
    saveConsent(value);
    setOpen(false);
    setView("banner");
  };

  const toggle = (key) =>
    setChoice((previous) => ({ ...previous, [key]: !previous[key] }));

  return (
    <div
      className={`cookie-consent cookie-consent--${view}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
    >
      <p className="cookie-consent__title" id="cookie-consent-title">
        {view === "settings" ? t("cookie.settingsTitle") : t("cookie.title")}
      </p>

      {view === "banner" ? (
        <p className="cookie-consent__text">
          {t("cookie.text")}{" "}
          <LocalizedLink to="/cookies-policy">
            {t("cookie.policy")}
          </LocalizedLink>
        </p>
      ) : (
        <ul className="cookie-consent__list">
          {CATEGORIES.map((key) => {
            const locked = key === "necessary";
            const checked = locked || choice[key];

            return (
              <li className="cookie-consent__category" key={key}>
                <div className="cookie-consent__category-text">
                  <strong>{t(`cookie.${key}.title`)}</strong>
                  <span>{t(`cookie.${key}.text`)}</span>
                </div>

                {locked ? (
                  <span className="cookie-consent__always">
                    {t("cookie.alwaysOn")}
                  </span>
                ) : (
                  <button
                    className={`cookie-consent__switch ${
                      checked ? "cookie-consent__switch--on" : ""
                    }`}
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={t(`cookie.${key}.title`)}
                    onClick={() => toggle(key)}
                  >
                    <span />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="cookie-consent__actions">
        {view === "banner" ? (
          <>
            <button
              className="cookie-consent__button cookie-consent__button--primary"
              type="button"
              onClick={() => decide(ALL)}
            >
              {t("cookie.accept")}
            </button>
            <button
              className="cookie-consent__button"
              type="button"
              onClick={() => decide(NONE)}
            >
              {t("cookie.reject")}
            </button>
            <button
              className="cookie-consent__link"
              type="button"
              onClick={() => setView("settings")}
            >
              {t("cookie.settings")}
            </button>
          </>
        ) : (
          <>
            <button
              className="cookie-consent__button cookie-consent__button--primary"
              type="button"
              onClick={() => decide(choice)}
            >
              {t("cookie.save")}
            </button>
            <button
              className="cookie-consent__button"
              type="button"
              onClick={() => decide(ALL)}
            >
              {t("cookie.accept")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default CookieConsent;
