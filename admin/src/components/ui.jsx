import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import Icon from "./Icon";
import { passwordScore } from "../lib/format";

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
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={17} />
      </button>
    </div>
  );
}

const STRENGTH = [
  ["#ff7d7d", "Очень слабый"],
  ["#ff7d7d", "Слабый"],
  ["#f0b429", "Средний"],
  ["#8bd450", "Надёжный"],
  ["#4fd88a", "Отличный"],
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
        {password ? `Надёжность: ${label}` : "Минимум 10 символов: буквы разного регистра, цифры, символы"}
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
  return src ? <img className="qr" src={src} width={size} height={size} alt="QR-код для приложения-аутентификатора" /> : null;
}

/** Модальне вікно: Esc і клік по фону закривають */
export function Modal({ title, onClose, wide = false, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (!panelRef.current?.contains(event.target)) onClose();
      }}
    >
      <div className={`modal__panel ${wide ? "modal__panel--wide" : ""}`} ref={panelRef}>
        <button type="button" className="icon-btn modal__close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
        {title && <h2 className="modal__title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/** Кнопка «копіювати» з підтвердженням */
export function CopyButton({ value, label = "Копировать", className = "icon-btn", children }) {
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
      {children && (done ? "Скопировано" : children)}
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
