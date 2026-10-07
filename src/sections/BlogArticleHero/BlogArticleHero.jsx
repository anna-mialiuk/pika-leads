import { LocalizedLink as Link, useLanguage } from "../../i18n";

import "./BlogArticleHero.sass";

function BlogArticleHero({ article }) {
  const { t } = useLanguage();

  if (!article) return null;

  const { category, image, title } = article;

  return (
    <section className="blog-article-hero">
      <div className="blog-article-hero__container">
        <nav
          className="blog-article-hero__breadcrumbs"
          aria-label={t("common.breadcrumbs")}
        >
          <Link to="/">{t("common.home")}</Link>

          <span>/</span>

          <Link to="/blog">{t("common.blog")}</Link>

          <span>/</span>

          <strong>{category}</strong>
        </nav>

        {image && (
          <div className="blog-article-hero__cover">
            <img src={image} alt={title} loading="eager" />
          </div>
        )}
      </div>
    </section>
  );
}

export default BlogArticleHero;
