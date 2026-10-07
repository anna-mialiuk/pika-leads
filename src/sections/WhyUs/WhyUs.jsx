import { useLanguage, useData } from "../../i18n";
import FeatureCard from "../../components/FeatureCard/FeatureCard";

import "./WhyUs.sass";

function WhyUs() {
  const { t } = useLanguage();
  const { whyUsCards } = useData("whyUsData");

  return (
    <section className="why-us">
      <div className="why-us__container">
        <h2 className="why-us__title">
          {t("whyUs.titleLine1")}
          <br />
          {t("whyUs.titleLine2")}
        </h2>

        <div className="why-us__list">
          {whyUsCards.map((card) => (
            <FeatureCard
              key={card.id}
              icon={card.icon}
              type={card.type}
              title={card.title}
              text={card.text}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default WhyUs;
