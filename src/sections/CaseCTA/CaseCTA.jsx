import { useLanguage } from "../../i18n";
import ConsultationTrigger from "../../components/ConsultationModal/ConsultationTrigger";

import "./CaseCTA.sass";

function CaseCTA({ cta }) {
  const { t } = useLanguage();

  if (!cta) return null;

  const {
    title,
    description,
    buttonText = t("common.getReview"),
    buttonLink = "#consultation",
  } = cta;

  return (
    <section className="case-cta">
      <div className="case-cta__container">
        <div className="case-cta__content">
          {title && <h2 className="case-cta__title">{title}</h2>}

          {description && (
            <p className="case-cta__description">{description}</p>
          )}
        </div>

        <ConsultationTrigger
          className="case-cta__button"
          href={buttonLink}
          source="case"
        >
          {buttonText}
        </ConsultationTrigger>
      </div>
    </section>
  );
}

export default CaseCTA;
