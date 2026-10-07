import ArticleCta from "../../components/BlogArticle/ArticleCta";
import ArticleNote from "../../components/BlogArticle/ArticleNote";
import ArticleBlocks from "../../content/ArticleBlocks";

import { DEFAULT_LANGUAGE, useLanguage } from "../../i18n";

import "./BlogArticleContent.sass";

/**
 * Текст статті. Блоки приходять із шару контенту (src/content/api.js):
 * src/content/blog/<мова>/<id>.json, згодом — з CMS.
 * Якщо перекладу немає — показується українська версія з плашкою.
 */
function BlogArticleContent({ article }) {
  const { lang, t } = useLanguage();

  if (!article) return null;

  const { blocks, isFallback } = article;

  return (
    <section className="blog-article-content">
      <article
        className="blog-article-content__body"
        lang={isFallback ? DEFAULT_LANGUAGE : undefined}
      >
        {isFallback && (
          <ArticleNote>
            <p lang={lang}>{t("blogArticle.untranslated")}</p>
          </ArticleNote>
        )}

        <ArticleBlocks blocks={blocks} />

        <div lang={isFallback ? lang : undefined}>
          <ArticleCta />
        </div>
      </article>
    </section>
  );
}

export default BlogArticleContent;
