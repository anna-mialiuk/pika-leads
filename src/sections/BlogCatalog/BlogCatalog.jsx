import { useMemo, useState } from "react";

import FilterGroup from "../../components/FilterGroup/FilterGroup";
import BlogCard from "../../components/BlogCard/BlogCard";

import { useLanguage, useData } from "../../i18n";
import { useArticles } from "../../content/hooks";
import { countBy, matches } from "../../utils/countBy";

import Icon from "../../components/Icon/Icon";

import "./BlogCatalog.sass";

const SEARCH_FIELDS = ["title", "description", "category"];

function BlogCatalog() {
  const { t } = useLanguage();
  const blogArticles = useArticles();
  const { blogTopics, blogLevels } = useData("blogPageData");

  const [activeTopic, setActiveTopic] = useState("all");
  const [activeLevel, setActiveLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return blogArticles.filter(
      (article) =>
        matches(article.topic, activeTopic) &&
        matches(article.level, activeLevel) &&
        (!query ||
          SEARCH_FIELDS.some((field) =>
            article[field].toLowerCase().includes(query),
          )),
    );
  }, [blogArticles, activeTopic, activeLevel, searchQuery]);

  const topicCounts = useMemo(
    () =>
      countBy(
        blogArticles.filter((article) => matches(article.level, activeLevel)),
        "topic",
      ),
    [blogArticles, activeLevel],
  );

  const levelCounts = useMemo(
    () =>
      countBy(
        blogArticles.filter((article) => matches(article.topic, activeTopic)),
        "level",
      ),
    [blogArticles, activeTopic],
  );

  return (
    <section className="blog-catalog">
      <div className="blog-catalog__container">
        <div className="blog-catalog__filters">
          <FilterGroup
            label={t("blogPage.topicFilter")}
            items={blogTopics}
            active={activeTopic}
            counts={topicCounts}
            onChange={setActiveTopic}
          />

          <FilterGroup
            label={t("blogPage.levelFilter")}
            items={blogLevels}
            active={activeLevel}
            counts={levelCounts}
            onChange={setActiveLevel}
          />
        </div>

        <div className="blog-catalog__search">
          <Icon name="search" className="blog-catalog__search-icon" />

          <input
            className="blog-catalog__search-input"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("blogPage.searchPlaceholder")}
          />
        </div>

        {filteredArticles.length > 0 ? (
          <div className="blog-catalog__list">
            {filteredArticles.map((article) => (
              <BlogCard key={article.id} {...article} variant="catalog" />
            ))}
          </div>
        ) : (
          <div className="blog-catalog__empty">{t("blogPage.empty")}</div>
        )}
      </div>
    </section>
  );
}

export default BlogCatalog;
