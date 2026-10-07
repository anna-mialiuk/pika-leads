import { useRef } from "react";
import { LocalizedLink as Link, useLanguage } from "../../i18n";

import "./CaseRelated.sass";

function CaseRelated({ currentCase, cases = [] }) {
  const sliderRef = useRef(null);

  const { t } = useLanguage();

  if (!currentCase) return null;

  const platformCases = cases.filter(
    (caseItem) =>
      caseItem.id !== currentCase.id &&
      caseItem.platform === currentCase.platform &&
      caseItem.image,
  );

  const sameNicheCases = platformCases.filter(
    (caseItem) => caseItem.niche === currentCase.niche,
  );

  const otherPlatformCases = platformCases.filter(
    (caseItem) => caseItem.niche !== currentCase.niche,
  );

  const relatedCases = [...sameNicheCases, ...otherPlatformCases].slice(0, 8);

  if (!relatedCases.length) return null;

  const scrollSlider = (direction) => {
    if (!sliderRef.current) return;

    const card = sliderRef.current.querySelector(".case-related__card");

    if (!card) return;

    const gap = parseFloat(getComputedStyle(sliderRef.current).columnGap) || 0;
    const scrollAmount = card.offsetWidth + gap;

    sliderRef.current.scrollBy({
      left: direction * scrollAmount,
      behavior: "smooth",
    });
  };

  const totalCases = cases.filter((caseItem) => caseItem.image).length;

  return (
    <section className="case-related">
      <div className="case-related__container">
        <div className="case-related__header">
          <div className="case-related__heading">
            <span className="case-related__kicker">
              {t("casePage.relatedKicker")}
            </span>

            <h2 className="case-related__title">
              {t("casePage.relatedTitle", { platform: currentCase.platform })}
            </h2>
          </div>

          {relatedCases.length > 1 && (
            <div className="case-related__navigation">
              <button
                className="case-related__arrow"
                type="button"
                onClick={() => scrollSlider(-1)}
                aria-label={t("casePage.relatedPrev")}
              >
                ‹
              </button>

              <button
                className="case-related__arrow"
                type="button"
                onClick={() => scrollSlider(1)}
                aria-label={t("casePage.relatedNext")}
              >
                ›
              </button>
            </div>
          )}
        </div>

        <div className="case-related__slider" ref={sliderRef}>
          {relatedCases.map((caseItem) => {
            const budgetMetric = caseItem.metrics?.find(
              (metric) => metric.accent,
            );

            return (
              <article className="case-related__card" key={caseItem.id}>
                <Link
                  className="case-related__image-wrapper"
                  to={`/cases/${caseItem.id}`}
                >
                  <img
                    className="case-related__image"
                    src={caseItem.image}
                    alt={caseItem.title}
                    loading="lazy"
                  />

                  <span className="case-related__platform">
                    {caseItem.platform}
                  </span>
                </Link>

                <div className="case-related__content">
                  <span
                    className="case-related__category"
                    style={{
                      color: caseItem.categoryColor,
                    }}
                  >
                    {caseItem.category}
                  </span>

                  <h3 className="case-related__card-title">
                    <Link to={`/cases/${caseItem.id}`}>{caseItem.title}</Link>
                  </h3>

                  <p className="case-related__description">
                    {caseItem.description}
                  </p>

                  <div className="case-related__footer">
                    <span className="case-related__metric">
                      {budgetMetric?.value || ""}
                    </span>

                    <Link
                      className="case-related__link"
                      to={`/cases/${caseItem.id}`}
                    >
                      {t("casePage.read")}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <Link className="case-related__all" to="/cases">
          <span aria-hidden="true">←</span>
          {t("casePage.allCases", { count: totalCases })}
        </Link>
      </div>
    </section>
  );
}

export default CaseRelated;
