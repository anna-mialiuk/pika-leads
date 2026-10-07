import { useLanguage } from "../../i18n";

import "./ArticleToc.sass";

function ArticleToc({ contents = [] }) {
  const { t } = useLanguage();

  if (!contents.length) return null;

  return (
    <aside className="article-toc">
      <div className="article-toc__sticky">
        <div className="article-toc__title">{t("blogArticle.toc")}</div>

        <nav
          className="article-toc__list"
          aria-label={t("blogArticle.tocLabel")}
        >
          {contents.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="article-toc__link">
              {item.title}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default ArticleToc;
