/**
 * PostCSS-плагін: на екранах ≤1024px збільшує розмір тексту в FACTOR разів.
 *
 * Навіщо: від 1140px увесь макет зменшується (html { font-size: 50% }),
 * і текст на телефонах/планшетах ставав надто дрібним. Плагін масштабує
 * лише font-size (у rem), не чіпаючи відступи, ширини й заголовки.
 *
 * Плюс для аудиторії 30+:
 *  - мінімум 13px для будь-якого тексту (підписи, бейджі, кікери) і 14px для кнопок/посилань-дій;
 *  - сірий текст на мобільних трохи світліший (вищий контраст).
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
// ≤1140px 1rem = 8px: 1.625rem = 13px, 1.75rem = 14px
const MIN_REM = 1.625;
const ACTION_MIN_REM = 1.75;
const ACTION_SELECTOR =
  /button|btn|__link|__more|__all|__arrow|__submit|__cta(?![\w-]*(title|description|text))/;

// світліші відтінки сірого тексту для мобільних
const COLOR_MAP = {
  "#a29c8f": "#b8b3a8", // $color-text-secondary
  "#8a8474": "#a39d8f", // $color-text-dim
};

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

  const scaledValue = (value, selector = "") => {
    const match = value.trim().match(/^(\d*\.?\d+)rem(\s*!important)?$/);
    if (!match) return null;
    const rem = Number(match[1]);
    if (rem > MAX_REM) return null;
    const min = ACTION_SELECTOR.test(selector) ? ACTION_MIN_REM : MIN_REM;
    const next = Math.max(rem * FACTOR, min);
    return `${Math.round(next * 1000) / 1000}rem${match[2] ?? ""}`;
  };

  /** Світліший сірий: відомі сірі кольори та напівпрозорий білий 0.5–0.78 → 0.8 */
  const lighterColor = (value) => {
    const color = value.trim().toLowerCase();
    if (COLOR_MAP[color]) return COLOR_MAP[color];
    const rgba = color.match(/^rgba\(\s*247,\s*245,\s*239,\s*(0?\.\d+)\s*\)$/);
    if (rgba && Number(rgba[1]) >= 0.5 && Number(rgba[1]) < 0.78) {
      return "rgba(247, 245, 239, 0.8)";
    }
    return null;
  };

  /** Копія правила лише з font-size, помноженими на FACTOR (або null) */
  const scaledCopy = (rule) => {
    if (isHeadingSelector(rule.selector)) return null;
    const copy = rule.clone();
    copy.removeAll();
    rule.walkDecls("font-size", (decl) => {
      const value = scaledValue(decl.value, rule.selector);
      if (value) copy.append(decl.clone({ value }));
    });
    rule.walkDecls("color", (decl) => {
      const value = lighterColor(decl.value);
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
              const value = scaledValue(decl.value, rule.selector);
              if (value) decl.value = value;
            });
            rule.walkDecls("color", (decl) => {
              const value = lighterColor(decl.value);
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
