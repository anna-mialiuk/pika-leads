/**
 * Vite-плагін для швидшого першого екрана на мобільних:
 *  1. вбудовує CSS, потрібний для першого рендеру, прямо в index.html
 *     (без окремих запитів, які блокують відображення);
 *  2. додає preload для основних шрифтів (кирилиця Manrope та Unbounded),
 *     щоб браузер почав їх вантажити одразу, а не після розбору CSS.
 */
export default function inlineCriticalCss() {
  return {
    name: "inline-critical-css",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (file) => file.type === "asset" && file.fileName === "index.html",
      );
      if (!html) return;

      let source = String(html.source);

      // <link rel="stylesheet" href="/assets/x.css"> → <style>…</style>
      source = source.replace(
        /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g,
        (tag, fileName) => {
          const css = bundle[fileName];
          if (!css || css.type !== "asset") return tag;
          return `<style>${String(css.source)}</style>`;
        },
      );

      const fonts = Object.keys(bundle).filter((name) =>
        /(manrope|unbounded)-cyrillic-wght-normal-[\w-]+\.woff2$/.test(name),
      );
      const preloads = fonts
        .map(
          (name) =>
            `<link rel="preload" href="/${name}" as="font" type="font/woff2" crossorigin>`,
        )
        .join("\n    ");

      if (preloads)
        source = source.replace("</title>", `</title>\n    ${preloads}`);

      html.source = source;
    },
  };
}
