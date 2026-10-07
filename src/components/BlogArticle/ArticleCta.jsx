import { useLanguage } from "../../i18n";
import ConsultationTrigger from "../ConsultationModal/ConsultationTrigger";

import "./ArticleCta.sass";

function ArticleCta() {
  const { t } = useLanguage();

  return (
    <div className="article-cta">
      <div className="article-cta__content">
        <h2 className="article-cta__title">
          {t("blogArticle.ctaTitleLine1")}
          <br />
          {t("blogArticle.ctaTitleLine2")}
        </h2>

        <p className="article-cta__description">{t("blogArticle.ctaText")}</p>
      </div>

      <ConsultationTrigger
        className="article-cta__button"
        href="#consultation"
        source="blog"
      >
        <span>{t("common.getReview")}</span>

        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12H19" />
          <path d="M13 6L19 12L13 18" />
        </svg>
      </ConsultationTrigger>
    </div>
  );
}

export default ArticleCta;
