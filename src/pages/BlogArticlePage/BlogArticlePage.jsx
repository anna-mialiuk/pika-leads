import { useParams } from "react-router-dom";

import Header from "../../sections/Header/Header";
import BlogArticleHero from "../../sections/BlogArticleHero/BlogArticleHero";
import BlogArticleIntro from "../../sections/BlogArticleIntro/BlogArticleIntro";
import BlogArticleContent from "../../sections/BlogArticleContent/BlogArticleContent";
import BlogRelated from "../../sections/BlogRelated/BlogRelated";

import ArticleToc from "../../components/BlogArticle/ArticleToc";
import Footer from "../../components/Footer/Footer";

import { LocalizedNavigate, Seo } from "../../i18n";
import { useArticle } from "../../content/hooks";

import "./BlogArticlePage.sass";

function BlogArticlePage() {
  const { slug } = useParams();

  const article = useArticle(slug);

  if (!article) {
    return <LocalizedNavigate to="/blog" replace />;
  }

  return (
    <>
      <Seo
        title={article.title}
        description={article.description}
        image={article.image}
        type="article"
      />

      <Header />

      <main className="blog-article-page">
        <BlogArticleHero article={article} />

        <div className="blog-article-page__article">
          <div className="blog-article-page__container">
            <div className="blog-article-page__content">
              <BlogArticleIntro article={article} />

              <BlogArticleContent article={article} />
            </div>

            <ArticleToc contents={article.toc} />
          </div>
        </div>

        <BlogRelated article={article} />
      </main>

      <Footer />
    </>
  );
}

export default BlogArticlePage;
