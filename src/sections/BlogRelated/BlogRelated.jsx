import { LocalizedLink as Link, useLanguage } from "../../i18n";
import { useArticles } from "../../content/hooks";

import BlogCard from "../../components/BlogCard/BlogCard";

import "./BlogRelated.sass";

function BlogRelated({ article }) {
  const { t } = useLanguage();
  const blogArticles = useArticles();

  if (!article) return null;

  const otherArticles = blogArticles.filter((item) => item.id !== article.id);

  const sameTopic = otherArticles.filter(
    (item) => item.topic === article.topic,
  );

  const otherTopics = otherArticles.filter(
    (item) => item.topic !== article.topic,
  );

  const relatedArticles = [...sameTopic, ...otherTopics].slice(0, 3);

  if (!relatedArticles.length) return null;

  return (
    <section className="blog-related">
      <div className="blog-related__container">
        <div className="blog-related__head">
          <h2 className="blog-related__title">
            {t("blogArticle.relatedTitle")}
          </h2>

          <Link to="/blog" className="blog-related__all">
            {t("blogArticle.allArticles", { count: blogArticles.length })}
          </Link>
        </div>

        <div className="blog-related__grid">
          {relatedArticles.map((item) => (
            <BlogCard key={item.id} {...item} variant="catalog" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default BlogRelated;
