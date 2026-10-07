import { useState } from "react";

import { useData } from "../../i18n";
import { formatPhone } from "../../utils/formatPhone";

import Icon from "../../components/Icon/Icon";

import "./PhoneField.sass";

function PhoneField({ value, onChange, className = "", inputName = "phone" }) {
  const { countries } = useData("auditData");

  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countryIndex, setCountryIndex] = useState(0);

  const currentCountry = countries[countryIndex];

  const handleCountryChange = (index) => {
    setCountryIndex(index);
    setIsCountryOpen(false);
  };

  const handlePhoneChange = (event) => {
    const formattedValue = formatPhone(event.target.value);

    onChange?.({
      number: formattedValue,
      country: currentCountry,
      fullNumber: `${currentCountry.code}${formattedValue.replace(/\D/g, "")}`,
    });
  };

  return (
    <div className={`phone-field ${className}`}>
      <div className="phone-field__country">
        <button
          className="phone-field__country-button"
          type="button"
          onClick={() => setIsCountryOpen((prev) => !prev)}
          aria-expanded={isCountryOpen}
        >
          <span className="phone-field__flag">{currentCountry.flag}</span>

          <span className="phone-field__code">{currentCountry.code}</span>

          <Icon
            name="chevron-down"
            className={`phone-field__arrow ${
              isCountryOpen ? "phone-field__arrow--active" : ""
            }`}
          />
        </button>

        {isCountryOpen && (
          <div className="phone-field__country-list">
            {countries.map((country, index) => (
              <button
                className={`phone-field__country-item ${
                  countryIndex === index
                    ? "phone-field__country-item--active"
                    : ""
                }`}
                type="button"
                key={`${country.name}-${country.code}`}
                onClick={() => handleCountryChange(index)}
              >
                <span className="phone-field__country-flag">
                  {country.flag}
                </span>

                <span className="phone-field__country-name">
                  {country.name}
                </span>

                <span className="phone-field__country-code">
                  {country.code}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        className="phone-field__input"
        type="tel"
        name={inputName}
        inputMode="numeric"
        autoComplete="tel"
        value={value}
        onChange={handlePhoneChange}
        placeholder="67 111 22 33"
        required
      />

      {/* Повний номер з кодом країни — для відправки заявки */}
      <input
        type="hidden"
        name={`${inputName}_full`}
        value={value ? `${currentCountry.code}${value.replace(/\D/g, "")}` : ""}
      />
    </div>
  );
}

export default PhoneField;
