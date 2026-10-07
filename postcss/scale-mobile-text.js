/**
 * PostCSS-плагін: на екранах ≤1024px збільшує розмір тексту в FACTOR разів.
 *
 * Навіщо: від 1140px увесь макет зменшується (html { font-size: 50% }),
 * і текст на телефонах/планшетах ставав надто дрібним. Плагін масштабує
 * лише font-size (у rem), не чіпаючи відступи, ширини й заголовки.
 *
 * Не масштабується:
 *  - заголовки h1/h2 (селектори з h1/h2 і класи, які стоять на h1/h2 у JSX);
 *  - великі «дисплейні» цифри й написи (font-size > MAX_REM);
 *  - значення не в rem (clamp(), px, em тощо).
 */
import fs from "node:fs";
import path from "node:path";

const FACTOR = 1.12;
const BREAKPOINT = 1024;
const MAX_REM = 2.4;

/** Класи, які в JSX стоять на <h1>/<h2> — їх не масштабуємо */
function collectHeadingClasses(srcDir) {
  const classes = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".jsx")) {
        const code = fs.readFileSync(full, "utf8");
        for (const match of code.matchAll(
          /<h[12]\s+[^>]*?className="([^"]+)"/g,
        )) {
          match[1].split(/\s+/).forEach((name) => classes.add(name));
        }
      }
    }
  };
  walk(srcDir);
  return classes;
}

const maxWidthOf = (params) => {
  const match = params.match(/max-width:\s*(\d+)px/);
  return match ? Number(match[1]) : null;
};

const hasMinWidth = (params) => /min-width/.test(params);

export default function scaleMobileText({ srcDir }) {
  const headingClasses = collectHeadingClasses(srcDir);

  const isHeadingSelector = (selector) =>
    /(^|[\s>+~,(])h[12](?![\w-])/.test(selector) ||
    [...selector.matchAll(/\.([\w-]+)/g)].some(([, name]) =>
      headingClasses.has(name),
    );

  const scaledValue = (value) => {
    const match = value.trim().match(/^(\d*\.?\d+)rem(\s*!important)?$/);
    if (!match) return null;
    const rem = Number(match[1]);
    if (rem > MAX_REM) return null;
    return `${Math.round(rem * FACTOR * 1000) / 1000}rem${match[2] ?? ""}`;
  };

  /** Копія правила лише з font-size, помноженими на FACTOR (або null) */
  const scaledCopy = (rule) => {
    if (isHeadingSelector(rule.selector)) return null;
    const copy = rule.clone();
    copy.removeAll();
    rule.walkDecls("font-size", (decl) => {
      const value = scaledValue(decl.value);
      if (value) copy.append(decl.clone({ value }));
    });
    return copy.nodes?.length ? copy : null;
  };

  return {
    postcssPlugin: "scale-mobile-text",
    OnceExit(root, { AtRule }) {
      root.each((node) => {
        // правило верхнього рівня → копія в @media (max-width: 1024px) одразу після нього
        if (node.type === "rule") {
          const copy = scaledCopy(node);
          if (copy) {
            const media = new AtRule({
              name: "media",
              params: `(max-width: ${BREAKPOINT}px)`,
            });
            media.append(copy);
            node.after(media);
          }
          return;
        }

        if (node.type !== "atrule" || node.name !== "media") return;

        const maxWidth = maxWidthOf(node.params);
        if (hasMinWidth(node.params) || maxWidth === null) return;

        if (maxWidth <= BREAKPOINT) {
          // медіа і так лише для ≤1024px — масштабуємо на місці
          node.walkRules((rule) => {
            if (isHeadingSelector(rule.selector)) return;
            rule.walkDecls("font-size", (decl) => {
              const value = scaledValue(decl.value);
              if (value) decl.value = value;
            });
          });
        } else {
          // ширша медіа (напр. ≤1140px) — копія для ≤1024px одразу після неї
          const media = new AtRule({
            name: "media",
            params: `(max-width: ${BREAKPOINT}px)`,
          });
          node.walkRules((rule) => {
            const copy = scaledCopy(rule);
            if (copy) media.append(copy);
          });
          if (media.nodes?.length) node.after(media);
        }
      });
    },
  };
}

scaleMobileText.postcss = true;
