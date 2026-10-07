import { LocalizedLink as Link, useLanguage } from "../../i18n";

import "./CaseCard.sass";

function CaseCard({
  id,
  category,
  categoryColor,
  platform,
  image,
  imageCard,
  number,
  kicker,
  title,
  description,
  metrics = [],
  linkLabel,
  featured = false,
}) {
  const { t } = useLanguage();

  const caseUrl = `/cases/${id}`;

  return (
    <article className={`case-card ${featured ? "case-card--featured" : ""}`}>
      <div className="case-card__media">
        <Link
          className="case-card__media-link"
          to={caseUrl}
          aria-label={t("caseCard.open", { title })}
        >
          <img
            className="case-card__image"
            src={imageCard || image}
            width="840"
            height="368"
            decoding="async"
            alt={title}
            loading="lazy"
          />

          <div className="case-card__media-overlay" />
        </Link>

        {category && (
          <span
            className="case-card__category"
            style={
              categoryColor
                ? { "--case-category-color": categoryColor }
                : undefined
            }
          >
            {category}
          </span>
        )}

        {number && <span className="case-card__number">{number}</span>}

        {platform && (
          <span
            className={`case-card__platform case-card__platform--${platform.toLowerCase()}`}
          >
            {platform}
          </span>
        )}
      </div>

      <div className="case-card__content">
        {kicker && <div className="case-card__kicker">{kicker}</div>}

        <h3 className="case-card__title">
          <Link className="case-card__title-link" to={caseUrl}>
            {title}
          </Link>
        </h3>

        {description && <p className="case-card__description">{description}</p>}

        {metrics.length > 0 && (
          <div className="case-card__metrics">
            {metrics.map((metric, index) => (
              <div
                className={`case-card__metric ${
                  metric.accent ? "case-card__metric--accent" : ""
                }`}
                key={`${metric.label}-${index}`}
              >
                <span
                  className={`case-card__metric-label ${
                    metric.accent ? "case-card__metric-label--accent" : ""
                  }`}
                >
                  {metric.label}
                </span>

                <strong
                  className={`case-card__metric-value ${
                    metric.type ? `case-card__metric-value--${metric.type}` : ""
                  }`}
                >
                  {metric.value}
                </strong>
              </div>
            ))}
          </div>
        )}

        <Link className="case-card__link" to={caseUrl}>
          <span>{linkLabel || t("common.readMore")}</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export default CaseCard;
