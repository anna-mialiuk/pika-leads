import { useState } from "react";
import { useLeadForm } from "../../hooks/useLeadForm";
import LeadFormError from "../LeadFormError/LeadFormError";

import PhoneField from "../PhoneField/PhoneField";
import FormSuccess from "../FormSuccess/FormSuccess";

import Icon from "../../components/Icon/Icon";
import { useLanguage } from "../../i18n";

import "./ContactForm.sass";

function ContactForm() {
  const { t } = useLanguage();

  const [phone, setPhone] = useState("");
  const { status, handleSubmit } = useLeadForm("question", {
    source: "contacts",
  });

  if (status === "success") {
    return (
      <div className="contact-form">
        <FormSuccess />
      </div>
    );
  }

  return (
    <div className="contact-form">
      <div className="contact-form__heading">
        <div className="contact-form__icon">
          <Icon name="comment" />
        </div>

        <div>
          <h2 className="contact-form__title">{t("contactsPage.formTitle")}</h2>

          <p className="contact-form__description">
            {t("contactsPage.formDescription")}
          </p>
        </div>
      </div>

      <form className="contact-form__form" onSubmit={handleSubmit}>
        <label className="contact-form__field">
          <span>{t("contactsPage.name")}</span>
          <input
            type="text"
            name="name"
            placeholder={t("contactsPage.namePlaceholder")}
            required
          />
        </label>

        <div className="contact-form__field">
          <span>{t("contactsPage.phoneLabel")}</span>
          <PhoneField
            value={phone}
            onChange={({ number }) => setPhone(number)}
          />
        </div>

        <label className="contact-form__field">
          <span>{t("contactsPage.emailLabel")}</span>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="contact-form__field">
          <span>{t("contactsPage.question")}</span>
          <textarea
            name="message"
            placeholder={t("contactsPage.questionPlaceholder")}
            required
          />
        </label>

        {status === "error" && <LeadFormError />}

        <button
          className="contact-form__submit"
          type="submit"
          disabled={status === "sending"}
        >
          {t("contactsPage.submit")}
        </button>
      </form>
    </div>
  );
}

export default ContactForm;
