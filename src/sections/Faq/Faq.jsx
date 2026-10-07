import { useState } from "react";

import Badge from "../../components/Badge/Badge";

import Button from "../../components/Button/Button";
import FaqItem from "../../components/FaqItem/FaqItem";

import { useLanguage, useData } from "../../i18n";

import "./Faq.sass";

function Faq({ items, description }) {
  const { t } = useLanguage();
  const { faqItems } = useData("faqData");
  const { contacts } = useData("headerData");

  const faqList = items ?? faqItems;
  const [activeItem, setActiveItem] = useState(null);

  const handleToggle = (id) => {
    setActiveItem((prev) => (prev === id ? null : id));
  };

  return (
    <section className="faq" id="faq">
      <div className="faq__container">
        <div className="faq__content">
          <Badge className="faq__label">{t("faq.badge")}</Badge>

          <h2 className="faq__title">
            {t("faq.titleStart")}
            <span>{t("faq.titleAccent")}</span>
          </h2>

          <p className="faq__description">
            {description ?? t("faq.description")}
          </p>

          <div className="faq__cta">
            <h3>{t("faq.ctaTitle")}</h3>

            <p>{t("faq.ctaText")}</p>

            <div className="faq__buttons">
              <Button
                href="#consultation"
                source="faq"
                variant="primary"
                size="large"
              >
                {t("common.getConsultation")}
              </Button>

              <Button
                href={`tel:${contacts.phone}`}
                variant="secondary"
                size="large"
              >
                {t("common.call")}
              </Button>
            </div>
          </div>
        </div>

        <div className="faq__list">
          {faqList.map((item, index) => (
            <FaqItem
              key={item.id}
              number={index + 1}
              question={item.question}
              answer={item.answer}
              isOpen={activeItem === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Faq;
