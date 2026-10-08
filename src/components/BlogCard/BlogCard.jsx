import { LocalizedLink as Link, useLanguage } from "../../i18n";

import "./BlogCard.sass";

function BlogCard({
  category,
  type,
  image,
  date,
  readTime,
  title,
  description,
  href,
  level,
  variant = "home",
}) {
  const { t } = useLanguage();

  const isCatalog = variant === "catalog";

  return (
    <article
      className={`blog-card ${
        isCatalog ? "blog-card--catalog" : "blog-card--home"
      }`}
    >
      <div className="blog-card__media">
        <Link className="blog-card__media-link" to={href}>
          <img
            className="blog-card__image"
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
          />
        </Link>

        <span className={`blog-card__category blog-card__category--${type}`}>
          {category}
        </span>
      </div>

      <div className="blog-card__content">
        {!isCatalog && (
          <div className="blog-card__meta blog-card__meta--top">
            <span>{date}</span>

            <span className="blog-card__meta-dot" />

            <span>{readTime}</span>
          </div>
        )}

        <h3 className="blog-card__title">
          <Link to={href}>{title}</Link>
        </h3>

        <p className="blog-card__description">{description}</p>

        {isCatalog ? (
          <div className="blog-card__footer">
            <div className="blog-card__meta">
              <span>{date}</span>

              <span className="blog-card__meta-dot" />

              <span>{readTime}</span>
            </div>

            {level && (
              <span className={`blog-card__level blog-card__level--${level}`}>
                {t(`blogCard.levels.${level}`)}
              </span>
            )}
          </div>
        ) : (
          <Link
            className={`blog-card__link blog-card__link--${type}`}
            to={href}
          >
            {t("blogCard.readArticle")}
            <span>→</span>
          </Link>
        )}
      </div>
    </article>
  );
}

export default BlogCard;
