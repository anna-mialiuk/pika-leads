/**
 * Перевірка перекладів: `npm run i18n:check` (запускається й перед `npm run build`).
 *
 * Помилки (зупиняють збірку):
 *  - ключ інтерфейсу є в uk.js, але відсутній в en.js / ru.js;
 *  - переклад посилається на id, якого немає в src/data;
 *  - масив перекладу довший за оригінал;
 *  - в англійській версії лишився кириличний текст;
 *  - у російській версії лишився український текст (і, ї, є, ґ).
 * Попередження:
 *  - числа в англійській з пробілом між тисячами ("24 000" → має бути "24,000");
 *  - стаття блогу без перекладу (показується українською з плашкою);
 *  - зайві ключі в en.js / ru.js, яких немає в uk.js.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({
  root,
  logLevel: "silent",
  server: { middlewareMode: true },
  appType: "custom",
});

const errors = [];
const warnings = [];

const CYRILLIC = /[\u0400-\u04FF]/;
const UKRAINIAN = /[іїєґІЇЄҐ]/;
const EN_NUMBER = /\d[ \u00a0]\d{3}(?![\d%])/;
const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const isPlural = (v) => isObject(v) && "other" in v;

/** Усі шляхи до рядків: [["a.b.c", "текст"], ...] */
function leaves(value, prefix = "") {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value))
    return value.flatMap((v, i) =>
      leaves(
        v,
        `${prefix}[${isObject(v) && v.id !== undefined ? `id=${v.id}` : i}]`,
      ),
    );
  if (isObject(value))
    return Object.entries(value).flatMap(([k, v]) =>
      leaves(v, prefix ? `${prefix}.${k}` : k),
    );
  return [];
}

function keys(value, prefix = "") {
  if (!isObject(value) || isPlural(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Структура перекладу має відповідати оригіналу */
function checkShape(base, override, where) {
  if (override === null || override === undefined) return;

  if (Array.isArray(base)) {
    if (isObject(override)) {
      const ids = new Set(base.map((item) => String(item?.id)));
      Object.keys(override).forEach((id) => {
        if (!ids.has(id))
          errors.push(`${where}: немає елемента з id "${id}" в оригіналі`);
        else
          checkShape(
            base.find((item) => String(item?.id) === id),
            override[id],
            `${where}.${id}`,
          );
      });
    } else if (Array.isArray(override)) {
      if (override.length > base.length)
        errors.push(
          `${where}: у перекладі ${override.length} елементів, в оригіналі ${base.length}`,
        );
      override.forEach((item, i) =>
        checkShape(base[i], item, `${where}[${i}]`),
      );
    }
    return;
  }

  if (isObject(base) && isObject(override)) {
    Object.keys(override).forEach((key) => {
      if (key in base) checkShape(base[key], override[key], `${where}.${key}`);
    });
  }
}

try {
  const load = (file) => server.ssrLoadModule(file);
  const { LANGUAGES, DEFAULT_LANGUAGE } = await load("/src/i18n/config.js");
  const { getData, loadTranslations } = await load("/src/i18n/content.js");
  const otherLanguages = LANGUAGES.map(({ code }) => code).filter(
    (c) => c !== DEFAULT_LANGUAGE,
  );

  // 1. Рядки інтерфейсу
  const locale = {};
  for (const { code } of LANGUAGES)
    locale[code] = (await load(`/src/i18n/locales/${code}.js`)).default;
  const baseKeys = new Set(keys(locale[DEFAULT_LANGUAGE]));

  for (const lang of otherLanguages) {
    const langKeys = new Set(keys(locale[lang]));
    baseKeys.forEach(
      (k) =>
        !langKeys.has(k) &&
        errors.push(`locales/${lang}.js: немає ключа "${k}"`),
    );
    langKeys.forEach(
      (k) =>
        !baseKeys.has(k) &&
        warnings.push(`locales/${lang}.js: зайвий ключ "${k}"`),
    );
  }

  // 2. Дані: структура перекладів і текст, що лишився неперекладеним
  const dataFiles = fs
    .readdirSync(path.join(root, "src/data"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => f.slice(0, -3));

  // Перевіряємо лише файли, які компоненти читають через useData("...")
  const sourceFiles = fs
    .readdirSync(path.join(root, "src"), { recursive: true })
    .filter((f) => /\.jsx?$/.test(f));
  const usedData = new Set(
    sourceFiles.flatMap((f) =>
      [
        ...fs
          .readFileSync(path.join(root, "src", f), "utf8")
          .matchAll(/useData\("(\w+)"\)/g),
      ].map((match) => match[1]),
    ),
  );

  for (const lang of otherLanguages) {
    await loadTranslations(lang);
    const dir = path.join(root, "src/i18n/content", lang);

    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
      const name = file.slice(0, -3);
      if (!dataFiles.includes(name)) {
        errors.push(
          `content/${lang}/${file}: немає відповідного src/data/${file}`,
        );
        continue;
      }
      const base = await load(`/src/data/${name}.js`);
      const override = await load(`/src/i18n/content/${lang}/${file}`);
      Object.keys(override).forEach((exp) =>
        checkShape(base[exp], override[exp], `content/${lang}/${name}.${exp}`),
      );
    }

    for (const name of dataFiles.filter((n) => usedData.has(n))) {
      for (const [where, text] of leaves({ ...getData(name, lang) })) {
        const place = `${lang}: src/data/${name}.js → ${where}`;
        if (lang === "en" && CYRILLIC.test(text))
          errors.push(`${place}: не перекладено «${text.slice(0, 60)}»`);
        if (lang === "ru" && UKRAINIAN.test(text))
          errors.push(`${place}: український текст «${text.slice(0, 60)}»`);
        if (lang === "en" && EN_NUMBER.test(text) && !/^\+\d/.test(text))
          warnings.push(`${place}: формат числа «${text}» (для EN — 1,000)`);
      }
    }

    for (const [where, text] of leaves(locale[lang])) {
      if (lang === "en" && CYRILLIC.test(text))
        errors.push(
          `locales/en.js → ${where}: кирилиця «${text.slice(0, 60)}»`,
        );
      if (lang === "ru" && UKRAINIAN.test(text))
        errors.push(
          `locales/ru.js → ${where}: український текст «${text.slice(0, 60)}»`,
        );
    }
  }

  // 3. Статті блогу: src/content/blog/<мова>/<id>.json
  const { blogArticles } = await load("/src/data/blogData.js");
  const blogDir = path.join(root, "src/content/blog");
  const BLOCK_TYPES = new Set([
    "heading",
    "paragraph",
    "list",
    "note",
    "code",
    "image",
  ]);
  const ids = new Set(blogArticles.map(({ id }) => id));

  for (const { id } of blogArticles) {
    for (const { code: lang } of LANGUAGES) {
      const file = path.join(blogDir, lang, `${id}.json`);
      const where = `content/blog/${lang}/${id}.json`;

      if (!fs.existsSync(file)) {
        if (lang === DEFAULT_LANGUAGE)
          errors.push(`blog "${id}": немає файлу ${where}`);
        else
          warnings.push(
            `blog "${id}": немає перекладу ${where} (буде українською з плашкою)`,
          );
        continue;
      }

      let body;
      try {
        body = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (error) {
        errors.push(`${where}: некоректний JSON (${error.message})`);
        continue;
      }

      (body.blocks ?? []).forEach((block, index) => {
        if (!BLOCK_TYPES.has(block.type))
          errors.push(
            `${where} → blocks[${index}]: невідомий тип блоку "${block.type}"`,
          );
        if (block.type === "code") return; // код не перекладаємо

        for (const [, text] of leaves(block)) {
          if (lang === "en" && CYRILLIC.test(text))
            errors.push(
              `${where} → blocks[${index}]: не перекладено «${text.slice(0, 60)}»`,
            );
          if (lang === "ru" && UKRAINIAN.test(text))
            errors.push(
              `${where} → blocks[${index}]: український текст «${text.slice(0, 60)}»`,
            );
        }
      });
    }
  }

  // 4. Юридичні сторінки: src/content/legal/<мова>/<slug>.json
  const legalDir = path.join(root, "src/content/legal");
  const legalSlugs = fs
    .readdirSync(path.join(legalDir, DEFAULT_LANGUAGE))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5));

  for (const slug of legalSlugs) {
    for (const lang of otherLanguages) {
      const file = path.join(legalDir, lang, `${slug}.json`);
      const where = `content/legal/${lang}/${slug}.json`;
      if (!fs.existsSync(file)) {
        warnings.push(`${where}: немає перекладу (буде українською)`);
        continue;
      }
      const page = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [key, text] of leaves({
        title: page.title,
        description: page.description,
        blocks: page.blocks,
      })) {
        if (lang === "en" && CYRILLIC.test(text))
          errors.push(
            `${where} → ${key}: не перекладено «${text.slice(0, 60)}»`,
          );
        if (
          lang === "ru" &&
          UKRAINIAN.test(text) &&
          !/Миколайович|Млинівська/.test(text)
        )
          errors.push(
            `${where} → ${key}: український текст «${text.slice(0, 60)}»`,
          );
      }
    }
  }

  // файли статей без картки в blogData
  for (const { code: lang } of LANGUAGES) {
    const dir = path.join(blogDir, lang);
    if (!fs.existsSync(dir)) continue;
    fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json") && !ids.has(f.slice(0, -5)))
      .forEach((f) =>
        warnings.push(
          `content/blog/${lang}/${f}: немає картки статті в src/data/blogData.js`,
        ),
      );
  }
} finally {
  await server.close();
}

warnings.forEach((w) => console.warn(`⚠  ${w}`));
errors.forEach((e) => console.error(`✖  ${e}`));
console.log(`\ni18n: ${errors.length} помилок, ${warnings.length} попереджень`);
process.exit(errors.length ? 1 : 0);
