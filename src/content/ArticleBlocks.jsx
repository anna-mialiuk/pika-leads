import ArticleNote from "../components/BlogArticle/ArticleNote";
import ArticleCodeBlock from "../components/BlogArticle/ArticleCodeBlock";

import { renderInline as renderInlineBase } from "./inline";
import { LocalizedLink } from "../i18n";

// внутрішні посилання ("/privacy-policy") — з мовним префіксом і без перезавантаження
const renderInline = (html) => renderInlineBase(html, { Link: LocalizedLink });

/**
 * Рендер тексту статті з блоків (формат, який зберігатиме CMS):
 *   heading   { level: 2|3, id?, text }
 *   paragraph { text }
 *   list      { style: "ordered"|"unordered", items: [text] }
 *   note      { text, variant?: "warning" }
 *   code      { code }
 *   image     { src, alt?, caption? }
 * text — рядок з інлайн-розміткою (<strong>, <em>, <a>, <code>, <br>).
 * H2 з id відкриває нову секцію (на неї веде зміст статті).
 */
function Block({ block }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 3 ? "h3" : "h2";
      return <Tag>{renderInline(block.text)}</Tag>;
    }
    case "paragraph":
      return <p>{renderInline(block.text)}</p>;
    case "list": {
      const Tag = block.style === "ordered" ? "ol" : "ul";
      return (
        <Tag>
          {block.items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case "note":
      return (
        <ArticleNote variant={block.variant}>
          {renderInline(block.text)}
        </ArticleNote>
      );
    case "code":
      return <ArticleCodeBlock>{block.code}</ArticleCodeBlock>;
    case "image":
      return (
        <figure className="blog-article-content__figure">
          <img
            src={block.src}
            alt={block.alt ?? ""}
            loading="lazy"
            decoding="async"
          />
          {block.caption && (
            <figcaption>{renderInline(block.caption)}</figcaption>
          )}
        </figure>
      );
    default:
      return null;
  }
}

/** Розбиває блоки на секції: усе до першого H2 — вступ, далі секція на кожен H2 з id */
function groupSections(blocks) {
  const groups = [{ id: null, blocks: [] }];

  blocks.forEach((block) => {
    if (block.type === "heading" && block.level === 2 && block.id) {
      groups.push({ id: block.id, blocks: [block] });
    } else {
      groups[groups.length - 1].blocks.push(block);
    }
  });

  return groups;
}

function ArticleBlocks({ blocks = [] }) {
  return groupSections(blocks).map((group, groupIndex) => {
    const content = group.blocks.map((block, index) => (
      <Block block={block} key={index} />
    ));

    if (!group.id) return content;

    return (
      <section
        className="blog-article-content__section"
        id={group.id}
        key={group.id || groupIndex}
      >
        {content}
      </section>
    );
  });
}

export default ArticleBlocks;
