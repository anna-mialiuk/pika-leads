import Header from "../../sections/Header/Header";
import Footer from "../../components/Footer/Footer";
import ArticleToc from "../../components/BlogArticle/ArticleToc";
import ArticleBlocks from "../../content/ArticleBlocks";

import { LEGAL_SLUGS } from "../../content/api";
import { useLegalPage } from "../../content/hooks";
import {
  LocalizedLink as Link,
  LocalizedNavigate,
  Seo,
  useLanguage,
} from "../../i18n";

import "../BlogArticlePage/BlogArticlePage.sass";
import "../../sections/BlogArticleContent/BlogArticleContent.sass";
import "./LegalPage.sass";

const LOCALES = { uk: "uk-UA", ru: "ru-RU", en: "en-GB" };

/** Юридичні документи: політика конфіденційності, cookies, дисклеймер, захист даних */
function LegalPage({ slug }) {
  const { lang, t } = useLanguage();
  const page = useLegalPage(slug);

  if (!page) return <LocalizedNavigate to="/" replace />;

  const updated = new Intl.DateTimeFormat(LOCALES[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(page.updatedAt));

  return (
    <>
      <Seo title={page.title} description={page.description} />

      <Header />

      <main className="legal-page">
        <section className="legal-page__hero">
          <div className="legal-page__container">
            <nav
              className="legal-page__breadcrumbs"
              aria-label={t("common.breadcrumbs")}
            >
              <Link to="/">{t("common.home")}</Link>
              <span>/</span>
              <strong>{page.title}</strong>
            </nav>

            <h1 className="legal-page__title">{page.title}</h1>

            <p className="legal-page__meta">
              <span>{t("legal.updated", { date: updated })}</span>
              <span>·</span>
              <span>{t("footer.legalEntity")}</span>
              <span>·</span>
              <a href="mailto:info@pika-leads.com">info@pika-leads.com</a>
            </p>
          </div>
        </section>

        <div className="blog-article-page__article">
          <div className="blog-article-page__container">
            <div className="blog-article-page__content">
              <article
                className="blog-article-content__body legal-page__body"
                lang={page.isFallback ? "uk" : undefined}
              >
                <ArticleBlocks blocks={page.blocks} />
              </article>

              <nav
                className="legal-page__related"
                aria-label={t("legal.related")}
              >
                <span>{t("legal.related")}</span>

                <ul>
                  {LEGAL_SLUGS.filter((item) => item !== slug).map((item) => (
                    <li key={item}>
                      <Link to={`/${item}`}>{t(`legal.titles.${item}`)}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <ArticleToc contents={page.toc} />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default LegalPage;
