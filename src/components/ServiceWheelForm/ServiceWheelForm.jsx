import { useState } from "react";
import { formToObject, sendLead } from "../../services/leads";
import LeadFormError from "../LeadFormError/LeadFormError";

import PhoneField from "../PhoneField/PhoneField";

import Icon from "../../components/Icon/Icon";
import { LocalizedLink, useLanguage } from "../../i18n";

import "./ServiceWheelForm.sass";

function ServiceWheelForm({ prize, onSuccess }) {
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [status, setStatus] = useState("idle");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim() || !phone.trim() || status === "sending") return;

    setStatus("sending");

    try {
      await sendLead({
        type: "bonus",
        source: "service-wheel",
        data: { ...formToObject(event.currentTarget), prize },
      });
      onSuccess();
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  return (
    <form className="service-wheel-form" onSubmit={handleSubmit}>
      <input
        className="service-wheel-form__input"
        type="text"
        name="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("serviceWheel.namePlaceholder")}
        required
      />

      <PhoneField
        className="service-wheel-form__phone"
        value={phone}
        onChange={({ number }) => setPhone(number)}
      />

      {status === "error" && <LeadFormError />}

      <button
        className="service-wheel-form__submit"
        type="submit"
        disabled={status === "sending"}
      >
        <span>{t("serviceWheel.claim")}</span>
        <Icon name="gift" />
      </button>

      <p className="service-wheel-form__policy">
        {t("serviceWheel.policy")}{" "}
        <LocalizedLink to="/privacy-policy">
          {t("serviceWheel.policyLink")}
        </LocalizedLink>
      </p>
    </form>
  );
}

export default ServiceWheelForm;
