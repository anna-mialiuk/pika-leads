import AuditForm from "../../components/AuditForm/AuditForm";
import Badge from "../../components/Badge/Badge";
import Icon from "../../components/Icon/Icon";

import { useLanguage, useData } from "../../i18n";

import "./ServiceAudit.sass";

function ServiceAudit({ data }) {
  const { t } = useLanguage();
  const { serviceAdsOptions } = useData("auditData");

  if (!data) return null;

  const {
    badge,
    titleBefore,
    titleAccent,
    description,
    subtitle,
    benefits = [],
    checklistImage,
    checklistAlt = t("serviceAudit.checklistAlt"),
    checklistLabel = t("serviceAudit.checklistLabel"),
    checklistPlaceholder = t("serviceAudit.checklistPlaceholder"),
  } = data;

  return (
    <section className="service-audit" id="service-audit">
      <div className="service-audit__container">
        <div className="service-audit__content">
          {badge && <Badge className="service-audit__badge">{badge}</Badge>}

          <h2 className="service-audit__title">
            {titleBefore} {titleAccent && <span>{titleAccent}</span>}
          </h2>

          {description && (
            <p className="service-audit__description">{description}</p>
          )}

          {subtitle && (
            <div className="service-audit__subtitle">{subtitle}</div>
          )}

          {benefits.length > 0 && (
            <div className="service-audit__benefits">
              {benefits.map((benefit) => (
                <div className="service-audit__benefit" key={benefit.text}>
                  <span className="service-audit__benefit-icon">
                    <Icon name="check" />
                  </span>

                  <span>
                    {benefit.text}
                    {benefit.accent && <strong> {benefit.accent}</strong>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {checklistImage ? (
            <button className="service-audit__checklist" type="button">
              <img src={checklistImage} alt={checklistAlt} loading="lazy" />

              <span className="service-audit__checklist-label">
                {checklistLabel}
              </span>

              <span className="service-audit__checklist-open">
                {t("serviceAudit.open")}
              </span>
            </button>
          ) : (
            <div className="service-audit__checklist service-audit__checklist--placeholder">
              <div className="service-audit__checklist-placeholder">
                <span className="service-audit__checklist-placeholder-icon">
                  ✓
                </span>

                <span>{checklistPlaceholder}</span>
              </div>

              <span className="service-audit__checklist-label">
                {checklistLabel}
              </span>
            </div>
          )}
        </div>

        <AuditForm
          variant="service"
          title={t("auditForm.serviceTitle")}
          platforms={serviceAdsOptions}
          submitText={t("auditForm.serviceSubmit")}
        />
      </div>
    </section>
  );
}

export default ServiceAudit;
