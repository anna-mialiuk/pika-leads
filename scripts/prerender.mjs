/**
 * Пререндер усіх сторінок у статичний HTML (запускається в кінці npm run build).
 *
 * 1. vite build          → dist/ (клієнтський сайт, шаблон dist/index.html)
 * 2. vite build --ssr    → dist-ssr/entry-server.js
 * 3. цей скрипт          → dist/<адреса>/index.html для кожної сторінки й мови
 *
 * Nginx віддає готовий файл (try_files $uri $uri/ …), браузер одразу бачить
 * сторінку з правильними title/description/Open Graph, а React «оживляє» її.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssrDir = path.join(root, "dist-ssr");

const { render, getRoutes } = await import(
  pathToFileURL(path.join(ssrDir, "entry-server.js")).href
);

const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const htmlLangs = { uk: "uk", en: "en", ru: "ru" };

const routes = await getRoutes();
let count = 0;
const failed = [];

for (const { lang, url } of routes) {
  try {
    const { html, head } = await render(url);

    const page = template
      .replace(
        /<html lang="[^"]*">/,
        `<html lang="${htmlLangs[lang] || lang}">`,
      )
      .replace(/<title>[\s\S]*?<\/title>/, head || "$&")
      .replace(/\s*<meta\s+name="description"[\s\S]*?\/>/, head ? "" : "$&")
      .replace('<div id="root"></div>', `<div id="root">${html}</div>`);

    const file =
      url === "/"
        ? path.join(dist, "index.html")
        : path.join(dist, url.replace(/^\//, ""), "index.html");

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, page);
    count += 1;
  } catch (error) {
    failed.push(`${url}: ${error.message}`);
  }
}

fs.rmSync(ssrDir, { recursive: true, force: true });

console.log(
  `prerender: ${count} сторінок${failed.length ? `, помилки: ${failed.length}` : ""}`,
);
if (failed.length) {
  failed.forEach((line) => console.error("  ✗", line));
  process.exit(1);
}
