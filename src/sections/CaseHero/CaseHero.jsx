import { LocalizedLink as Link, useLanguage } from "../../i18n";

import "./CaseHero.sass";

function CaseHero({ caseItem }) {
  const { t } = useLanguage();

  if (!caseItem) return null;

  const { number, source, category, categoryColor, title, description, image } =
    caseItem;

  return (
    <section className="case-hero">
      <div className="case-hero__container">
        <nav
          className="case-hero__breadcrumbs"
          aria-label={t("common.breadcrumbs")}
        >
          <Link to="/">{t("common.home")}</Link>

          <span>/</span>

          <Link to="/cases">{t("common.cases")}</Link>

          <span>/</span>

          <span className="case-hero__breadcrumbs-platform">
            {source === "meta" ? "Meta" : source}
          </span>

          <span>/</span>

          <span>{category}</span>
        </nav>

        <div className="case-hero__card">
          <img
            className="case-hero__image"
            src={image}
            alt={title}
            fetchPriority="high"
          />

          <div className="case-hero__overlay" />

          <div className="case-hero__content">
            <div className="case-hero__badges">
              <span className="case-hero__platform">
                {source === "meta" ? "Meta" : source}
              </span>

              <span
                className="case-hero__category"
                style={{ "--case-category-color": categoryColor }}
              >
                {category}
              </span>

              <span className="case-hero__number">{number}</span>
            </div>

            <h1 className="case-hero__title">{title}</h1>

            {description && (
              <p className="case-hero__description">{description}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CaseHero;
