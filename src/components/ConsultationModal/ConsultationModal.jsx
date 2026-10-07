import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import PhoneField from "../PhoneField/PhoneField";
import FormSuccess from "../FormSuccess/FormSuccess";
import LeadFormError from "../LeadFormError/LeadFormError";
import { useLeadForm } from "../../hooks/useLeadForm";

import { useLanguage } from "../../i18n";

import "./ConsultationModal.sass";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]):not([type="hidden"]), [href], [tabindex]:not([tabindex="-1"])';

function ConsultationModal({ source, onClose }) {
  const { t } = useLanguage();
  const titleId = useId();
  const dialogRef = useRef(null);

  const [phone, setPhone] = useState("");
  const { status, handleSubmit } = useLeadForm("consultation", { source });
  const isSubmitted = status === "success";

  // Блокуємо прокрутку сторінки, фокус на першому полі, Esc і Tab усередині попапу
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    dialogRef.current?.querySelector(".consultation-modal__input")?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const elements = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="consultation-modal"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="consultation-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <button
          className="consultation-modal__close"
          type="button"
          onClick={onClose}
          aria-label={t("consultation.close")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {isSubmitted ? (
          <div className="consultation-modal__success" id={titleId}>
            <FormSuccess />
          </div>
        ) : (
          <>
            <h2 className="consultation-modal__title" id={titleId}>
              {t("consultation.title")}
            </h2>

            <p className="consultation-modal__text">{t("consultation.text")}</p>

            <form className="consultation-modal__form" onSubmit={handleSubmit}>
              <input
                className="consultation-modal__input"
                type="text"
                name="name"
                placeholder={t("consultation.name")}
                aria-label={t("consultation.name")}
                autoComplete="name"
                required
              />

              <PhoneField
                className="consultation-modal__phone"
                value={phone}
                onChange={({ number }) => setPhone(number)}
              />

              <input
                className="consultation-modal__input"
                type="text"
                name="telegram"
                placeholder={t("consultation.telegram")}
                aria-label={t("consultation.telegram")}
              />

              <input
                className="consultation-modal__input"
                type="text"
                name="niche"
                placeholder={t("consultation.niche")}
                aria-label={t("consultation.niche")}
              />

              {status === "error" && <LeadFormError />}

              <button
                className="consultation-modal__submit"
                type="submit"
                disabled={status === "sending"}
              >
                {t("consultation.submit")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default ConsultationModal;
