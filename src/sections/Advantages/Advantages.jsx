import FeatureCard from "../../components/FeatureCard/FeatureCard";
import { useLanguage, useData } from "../../i18n";

import "./Advantages.sass";

function Advantages() {
  const { t } = useLanguage();
  const { advantagesCards } = useData("advantagesData");

  return (
    <section className="advantages">
      <div className="advantages__container">
        <h2 className="advantages__title">{t("advantages.title")}</h2>

        <div className="advantages__list">
          {advantagesCards.map((card) => (
            <FeatureCard key={card.id} {...card} variant="metric" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Advantages;
