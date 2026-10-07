import { useLanguage } from "../../i18n";

import "./CaseResults.sass";

function CaseResults({ results }) {
  const { t } = useLanguage();

  if (!results) return null;

  const { title = t("casePage.results"), rows = [], summary } = results;

  if (!rows.length && !summary) return null;

  return (
    <section className="case-results">
      <div className="case-results__container">
        {title && <h2 className="case-results__title">{title}</h2>}

        {rows.length > 0 && (
          <div className="case-results__table">
            {rows.map((row, index) => (
              <div className="case-results__row" key={`${row.label}-${index}`}>
                <span className="case-results__row-label">{row.label}</span>

                <strong className="case-results__row-value">{row.value}</strong>

                {row.note && (
                  <span className="case-results__row-note">{row.note}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {summary && (
          <div className="case-results__summary">
            <div className="case-results__summary-head">
              <h3 className="case-results__summary-title">{summary.title}</h3>

              {summary.badge && (
                <span className="case-results__summary-badge">
                  {summary.badge}
                </span>
              )}
            </div>

            {summary.items?.length > 0 && (
              <div className="case-results__summary-grid">
                {summary.items.map((item, index) => (
                  <div
                    className="case-results__summary-item"
                    key={`${item.label}-${index}`}
                  >
                    <span className="case-results__summary-label">
                      {item.label}
                    </span>

                    <strong
                      className={`case-results__summary-value ${
                        item.type
                          ? `case-results__summary-value--${item.type}`
                          : ""
                      }`}
                    >
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            {summary.note && (
              <p className="case-results__summary-note">{summary.note}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default CaseResults;
