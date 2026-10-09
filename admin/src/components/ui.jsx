import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import Icon from "./Icon";
import { passwordScore } from "../lib/format";
import { t, tt, LANG, LANGS, setLang } from "../lib/i18n";

/** Поле пароля з кнопкою «показати» */
export function PasswordInput({ value, onChange, placeholder = "••••••••", autoComplete, autoFocus, onEnter }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        className="input"
        type={visible ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onEnter?.()}
      />
      <button
        type="button"
        className="password-input__eye"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("Скрыть пароль") : t("Показать пароль")}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={17} />
      </button>
    </div>
  );
}

const STRENGTH = [
  ["#ff7d7d", t("Очень слабый")],
  ["#ff7d7d", t("Слабый")],
  ["#f0b429", t("Средний")],
  ["#8bd450", t("Надёжный")],
  ["#4fd88a", t("Отличный")],
];

/** Індикатор надійності (як у макеті) */
export function StrengthMeter({ password }) {
  const score = passwordScore(password);
  const [color, label] = STRENGTH[score];
  return (
    <div className="strength">
      <div className="strength__bars">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} style={{ background: score >= i ? color : "var(--border2)" }} />
        ))}
      </div>
      <div className="strength__label" style={{ color: password ? color : "var(--faint)" }}>
        {password ? tt("Надёжность: {0}", label) : t("Минимум 10 символов: буквы разного регистра, цифры, символы")}
      </div>
    </div>
  );
}

/** 6-значний код 2FA */
export function CodeInput({ value, onChange, onEnter, autoFocus = true }) {
  return (
    <input
      className="input code-input"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="000000"
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      onKeyDown={(event) => event.key === "Enter" && onEnter?.()}
    />
  );
}

/** QR-код для застосунку-аутентифікатора (генерується в браузері) */
export function QrCode({ text, size = 176 }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(text, { width: size * 2, margin: 1, color: { dark: "#121110", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [text, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={t("QR-код для приложения-аутентификатора")} /> : null;
}

/** Модальне вікно: Esc і клік по фону закривають */
export function Modal({ title, onClose, wide = false, className = "", children }) {
  const panelRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    // Escape закриває лише верхнє вікно (задача поверх картки заявки)
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      const open = document.querySelectorAll(".modal");
      if (open[open.length - 1] === overlayRef.current) onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={overlayRef}
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        // події з вкладеного вікна (портал) сюди теж спливають — їх ігноруємо
        if (!overlayRef.current?.contains(event.target)) return;
        if (!panelRef.current?.contains(event.target)) onClose();
      }}
    >
      <div className={`modal__panel ${wide ? "modal__panel--wide" : ""} ${className}`} ref={panelRef}>
        <button type="button" className="icon-btn modal__close" onClick={onClose} aria-label={t("Закрыть")}>
          <Icon name="close" />
        </button>
        {title && <h2 className="modal__title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Кнопка «копіювати» з підтвердженням */
export function CopyButton({ value, label = t("Копировать"), className = "icon-btn", children }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
    >
      <Icon name={done ? "check" : "copy"} />
      {children && (done ? t("Скопировано") : children)}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

export const ErrorAlert = ({ error }) => (error ? <div className="alert">⚠ {error}</div> : null);

/** Перемикач мови панелі RU / UA (вибір запам'ятовується в браузері) */
export function LangSwitch({ className = "" }) {
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t("Язык панели")}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={l.code === LANG ? "is-active" : ""}
          aria-pressed={l.code === LANG}
          title={l.name}
          onClick={() => l.code !== LANG && setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
