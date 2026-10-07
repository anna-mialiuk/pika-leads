import { useLanguage } from "../../i18n";

import "./CaseEvidence.sass";

function CaseEvidence({ evidence, onImageClick, galleryIndexes = [] }) {
  const { t } = useLanguage();

  if (!evidence) return null;

  const {
    title = t("casePage.evidence"),
    description,
    screenshots = [],
  } = evidence;

  if (!screenshots.length) return null;

  return (
    <section className="case-evidence">
      <div className="case-evidence__container">
        {title && <h2 className="case-evidence__title">{title}</h2>}

        <div className="case-evidence__screenshots">
          {screenshots.map((screenshot, index) => (
            <button
              className="case-evidence__screenshot"
              type="button"
              key={`${screenshot.image}-${index}`}
              onClick={() => onImageClick?.(galleryIndexes[index] ?? index)}
              aria-label={t("common.openScreenshot", { n: index + 1 })}
            >
              <img
                className="case-evidence__image"
                src={screenshot.image}
                alt={screenshot.alt || ""}
                loading="lazy"
              />

              <span className="case-evidence__zoom" aria-hidden="true">
                ⌕
              </span>

              <span className="case-evidence__overlay" aria-hidden="true" />
            </button>
          ))}
        </div>

        {description && (
          <p className="case-evidence__description">{description}</p>
        )}
      </div>
    </section>
  );
}

export default CaseEvidence;
