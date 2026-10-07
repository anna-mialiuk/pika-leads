import Badge from "../../components/Badge/Badge";

import { useLanguage } from "../../i18n";
import { useArticles } from "../../content/hooks";

import "./BlogHero.sass";

function BlogHero() {
  const { t } = useLanguage();
  const blogArticles = useArticles();

  return (
    <section className="blog-hero">
      <div className="blog-hero__container">
        <Badge className="blog-hero__badge">
          {t("blogPage.badge", { count: blogArticles.length })}
        </Badge>

        <h1 className="blog-hero__title">
          {t("blogPage.titleLine1")}
          <br />
          {t("blogPage.titleLine2")}
          <span>{t("blogPage.titleAccent")}</span>
        </h1>

        <p className="blog-hero__description">{t("blogPage.description")}</p>
      </div>
    </section>
  );
}

export default BlogHero;
