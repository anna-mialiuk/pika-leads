import { useState } from "react";

import PhoneField from "../PhoneField/PhoneField";

/** Поле телефону + кнопка. onSubmit отримує повний номер (+380…) */
function CallbackForm({ submitText, onSubmit, className = "" }) {
  const [phone, setPhone] = useState({ number: "", fullNumber: "" });
  const [isInvalid, setIsInvalid] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (phone.number.replace(/\D/g, "").length < 7) {
      setIsInvalid(true);
      event.currentTarget.querySelector("input[type='tel']")?.focus();
      return;
    }

    onSubmit(phone.fullNumber);
  };

  return (
    <form className={`callback-form ${className}`} onSubmit={handleSubmit}>
      <PhoneField
        className={isInvalid ? "phone-field--invalid" : ""}
        value={phone.number}
        onChange={({ number, fullNumber }) => {
          setPhone({ number, fullNumber });
          setIsInvalid(false);
        }}
      />

      <button className="callback-form__submit" type="submit">
        {submitText}
      </button>
    </form>
  );
}

export default CallbackForm;
