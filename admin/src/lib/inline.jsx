import { Fragment } from "react";

/**
 * Безпечний рендер інлайн-розмітки з CMS (без dangerouslySetInnerHTML).
 * Дозволені теги: <br>, <strong>/<b>, <em>/<i>, <code>, <a href="...">.
 * Усе інше показується як звичайний текст.
 */
const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: "\u00a0",
};
const decode = (text) =>
  text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, entity) => ENTITIES[entity]);

const TAGS = {
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
  code: "code",
  a: "a",
};
const TOKEN =
  /<br\s*\/?>|<(\/?)(strong|b|em|i|code|a)(\s+href="([^"]*)")?\s*>/gi;

const safeHref = (href = "") =>
  /^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : undefined;

/**
 * options.Link — компонент для внутрішніх посилань ("/…"), напр. LocalizedLink
 */
export function renderInline(html = "", { Link } = {}) {
  const root = { children: [] };
  const stack = [root];
  let lastIndex = 0;
  let key = 0;

  const push = (node) => stack[stack.length - 1].children.push(node);

  html.replace(TOKEN, (match, closing, tag, _attr, href, index) => {
    if (index > lastIndex) push(decode(html.slice(lastIndex, index)));
    lastIndex = index + match.length;

    if (!tag) {
      push(<br key={`br-${key++}`} />);
      return match;
    }

    const name = TAGS[tag.toLowerCase()];

    if (closing) {
      const top = stack[stack.length - 1];
      if (stack.length > 1 && top.name === name) {
        stack.pop();
        push(top.element(top.children, key++));
      }
      return match;
    }

    stack.push({
      name,
      children: [],
      element: (children, k) => {
        if (name === "a") {
          const url = safeHref(href);
          if (Link && url?.startsWith("/")) {
            return (
              <Link key={k} to={url}>
                {children}
              </Link>
            );
          }
          const external = url && /^https?:/i.test(url);
          return (
            <a
              key={k}
              href={url}
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {children}
            </a>
          );
        }
        const Tag = name;
        return <Tag key={k}>{children}</Tag>;
      },
    });
    return match;
  });

  if (lastIndex < html.length) push(decode(html.slice(lastIndex)));

  // незакриті теги — просто виводимо їхній вміст
  while (stack.length > 1) {
    const top = stack.pop();
    push(<Fragment key={key++}>{top.children}</Fragment>);
  }

  return root.children;
}

/** Текст без розмітки (для змісту, meta description тощо) */
export const toPlainText = (html = "") =>
  decode(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
