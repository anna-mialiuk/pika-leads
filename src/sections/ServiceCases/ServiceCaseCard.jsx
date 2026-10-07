import { LocalizedLink as Link, useLanguage } from "../../i18n";

/** Картка кейсу в секції ServiceCases: реальний кейс (посилання) або превʼю */
function ServiceCaseCard({ item, sourceLabel, isPreview }) {
  const { t } = useLanguage();

  const [, resultMetric, , spentMetric] = item.metrics || [];

  const content = (
    <>
      <div
        className={`service-cases__image ${
          item.image ? "" : "service-cases__image--gradient"
        }`}
        style={
          item.image
            ? undefined
            : {
                background:
                  item.visualGradient ||
                  "linear-gradient(135deg, #1D9BF0, #4DB5F5)",
              }
        }
      >
        {item.image ? (
          <img src={item.image} alt={item.title} loading="lazy" />
        ) : (
          <div className="service-cases__image-pattern" />
        )}

        {!isPreview && <div className="service-cases__image-overlay" />}

        <div className="service-cases__tags">
          <span className="service-cases__tag service-cases__tag--niche">
            {item.category}
          </span>

          {!isPreview && (
            <span className="service-cases__tag service-cases__tag--source">
              {sourceLabel}
            </span>
          )}
        </div>
      </div>

      <div className="service-cases__content">
        <h3 className="service-cases__card-title">{item.title}</h3>

        {isPreview ? (
          <>
            <div className="service-cases__metrics service-cases__metrics--preview">
              {item.metrics?.slice(0, 2).map((metric) => (
                <div
                  className="service-cases__metric service-cases__metric--preview"
                  key={metric.label}
                >
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>

            <p className="service-cases__description">{item.description}</p>
          </>
        ) : (
          <>
            <p className="service-cases__description">{item.description}</p>

            <div className="service-cases__metrics">
              {spentMetric && (
                <div className="service-cases__metric">
                  <span>{t("serviceCases.spent")}</span>
                  <strong>{spentMetric.value}</strong>
                </div>
              )}

              {resultMetric && (
                <div className="service-cases__metric">
                  <span>ROI</span>
                  <strong>{resultMetric.value}</strong>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );

  if (isPreview) {
    return <article className="service-cases__card">{content}</article>;
  }

  return (
    <Link className="service-cases__card" to={`/cases/${item.id}`}>
      {content}
    </Link>
  );
}

export default ServiceCaseCard;
