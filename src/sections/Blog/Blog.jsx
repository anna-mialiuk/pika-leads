import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";
import BlogCard from "../../components/BlogCard/BlogCard";
import { useLanguage } from "../../i18n";
import { useFeaturedArticles } from "../../content/hooks";

import "./Blog.sass";

function Blog() {
  const { t } = useLanguage();
  const blogArticles = useFeaturedArticles(3);

  return (
    <section className="blog" id="blog">
      <div className="blog__container">
        <div className="blog__heading">
          <div className="blog__heading-main">
            <Badge className="blog__label">{t("blogSection.badge")}</Badge>

            <h2 className="blog__title">
              {t("blogSection.titleStart")}
              <span>{t("blogSection.titleAccent")}</span>
            </h2>
          </div>

          <div className="blog__heading-side">
            <p className="blog__description">{t("blogSection.description")}</p>

            <Button
              className="blog__all-link"
              href="/blog"
              variant="outline"
              size="small"
              arrow
            >
              {t("blogSection.allArticles")}
            </Button>
          </div>
        </div>

        <div className="blog__list">
          {blogArticles.map((article) => (
            <BlogCard key={article.id} {...article} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Blog;
