import { useLanguage } from "../../i18n";

import "./BlogArticleIntro.sass";

function BlogArticleIntro({ article }) {
  const { t } = useLanguage();

  if (!article) return null;

  const {
    category,
    level,
    title,
    description,
    date,
    readTime,
    author = t("blogArticle.author"),
  } = article;

  const levelLabel = level ? t(`blogArticle.levels.${level}`) : null;

  return (
    <section className="blog-article-intro">
      <div className="blog-article-intro__badges">
        {category && (
          <span className="blog-article-intro__badge">{category}</span>
        )}

        {levelLabel && (
          <span className="blog-article-intro__level">{levelLabel}</span>
        )}
      </div>

      <h1 className="blog-article-intro__title">{title}</h1>

      {description && (
        <p className="blog-article-intro__description">{description}</p>
      )}

      <div className="blog-article-intro__meta">
        <div className="blog-article-intro__author">
          <span className="blog-article-intro__author-avatar">P</span>

          <strong>{author}</strong>
        </div>

        {date && <span className="blog-article-intro__meta-item">{date}</span>}

        {readTime && (
          <span className="blog-article-intro__meta-item">{readTime}</span>
        )}
      </div>
    </section>
  );
}

export default BlogArticleIntro;
