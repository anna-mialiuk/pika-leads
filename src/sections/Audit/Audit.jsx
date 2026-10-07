import { useLanguage, useData } from "../../i18n";
import Badge from "../../components/Badge/Badge";

import AuditForm from "../../components/AuditForm/AuditForm";

import auditExample from "../../assets/images/leadgen-audit.webp";
import auditExampleSmall from "../../assets/images/leadgen-audit-800.webp";

import "./Audit.sass";

function Audit() {
  const { t } = useLanguage();
  const { auditBenefits } = useData("auditData");

  return (
    <section className="audit">
      <div className="audit__container">
        <div className="audit__content">
          <Badge className="audit__badge">{t("audit.badge")}</Badge>

          <h2 className="audit__title">
            {t("audit.titleStart")}
            <span>{t("audit.titleAccent")}</span>
            {t("audit.titleEnd")}
          </h2>

          <p className="audit__text">{t("audit.text")}</p>

          <div className="audit__benefits">
            {auditBenefits.map((benefit, index) => (
              <div className="audit__benefit" key={benefit}>
                <span className="audit__benefit-icon">✓</span>

                <span>
                  {benefit}

                  {index === auditBenefits.length - 1 && (
                    <strong> {t("audit.gift")}</strong>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="audit__example">
            <img
              className="audit__example-image"
              src={auditExample}
              srcSet={`${auditExampleSmall} 800w, ${auditExample} 1672w`}
              sizes="(max-width: 1024px) 92vw, 580px"
              width="1672"
              height="941"
              loading="lazy"
              decoding="async"
              alt={t("audit.exampleAlt")}
            />

            <span className="audit__example-label">
              <span />
              {t("audit.exampleLabel")}
            </span>
          </div>
        </div>

        <AuditForm />
      </div>
    </section>
  );
}

export default Audit;
