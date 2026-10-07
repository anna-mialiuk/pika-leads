import { useState } from "react";
import { useLeadForm } from "../../hooks/useLeadForm";
import LeadFormError from "../LeadFormError/LeadFormError";

import { advertisingPlatforms } from "../../data/auditData";
import { useLanguage } from "../../i18n";

import Button from "../Button/Button";
import CountdownTimer from "../CountdownTimer/CountdownTimer";
import PhoneField from "../PhoneField/PhoneField";
import FormSuccess from "../FormSuccess/FormSuccess";

import "./AuditForm.sass";

/**
 * Форма заявки на аудит із таймером.
 * variant="service" — версія для сторінок послуг (акцент теми, текст заголовка).
 */
function AuditForm({
  variant = "default",
  title,
  platforms = advertisingPlatforms,
  submitText,
}) {
  const { t } = useLanguage();

  const [phone, setPhone] = useState("");
  const { status, handleSubmit } = useLeadForm(
    variant === "service" ? "service-audit" : "audit",
    { source: variant },
  );

  return (
    <div className={`audit-form audit-form--${variant}`}>
      {status === "success" ? (
        <FormSuccess />
      ) : (
        <>
          <CountdownTimer />

          <form className="audit-form__body" onSubmit={handleSubmit}>
            <div className="audit-form__heading">
              <h3>{title ?? t("auditForm.title")}</h3>
              <p>{t("auditForm.responseTime")}</p>
            </div>

            <label className="audit-form__field">
              <span>{t("auditForm.name")}</span>
              <input
                type="text"
                name="name"
                placeholder={t("auditForm.namePlaceholder")}
                required
              />
            </label>

            <div className="audit-form__row">
              <div className="audit-form__field">
                <span>{t("auditForm.phone")}</span>
                <PhoneField
                  value={phone}
                  onChange={({ number }) => setPhone(number)}
                />
              </div>

              <label className="audit-form__field">
                <span>{t("auditForm.messenger")}</span>
                <input type="text" name="messenger" placeholder="@username" />
              </label>
            </div>

            <label className="audit-form__field">
              <span>{t("auditForm.business")}</span>
              <input
                type="text"
                name="business"
                placeholder={t("auditForm.businessPlaceholder")}
                required
              />
            </label>

            <div className="audit-form__platforms">
              <span>{t("auditForm.platforms")}</span>

              <div className="audit-form__platform-list">
                {platforms.map((platform) => (
                  <label className="audit-form__platform" key={platform}>
                    <input type="checkbox" name="platforms" value={platform} />
                    <span>{platform}</span>
                  </label>
                ))}
              </div>
            </div>

            {status === "error" && <LeadFormError />}

            <Button
              className="audit-form__submit"
              type="submit"
              arrow
              disabled={status === "sending"}
            >
              {submitText ?? t("auditForm.submit")}
            </Button>

            <p className="audit-form__note">{t("auditForm.note")}</p>
          </form>
        </>
      )}
    </div>
  );
}

export default AuditForm;
