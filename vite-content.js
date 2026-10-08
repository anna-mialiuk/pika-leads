/**
 * Контент, який редагується в адмінці (app.pika-leads.com):
 *   src/content/cases/<id>.json     — кейси
 *   src/content/articles/<id>.json  — картки статей блогу (тексти — src/content/blog/<мова>/<id>.json)
 *   src/content/reviews/<id>.json   — відгуки
 *
 * Перекладні рядки зберігаються як { "uk": "…", "en": "…", "ru": "…" }
 * (немає перекладу — показується українська). Картинки — шлях відносно
 * src/assets/images ("cases/foo.webp"), Vite обробляє їх як звичайні імпорти.
 *
 * Плагін віддає віртуальні модулі:
 *   virtual:pika-content/<колекція>/uk  — повні дані (як раніше src/data/*.js)
 *   virtual:pika-content/<колекція>/en  — лише переклади (як src/i18n/content/en/*.js)
 */
import fs from "node:fs";
import path from "node:path";

const PREFIX = "virtual:pika-content/";
const RESOLVED = `\0${PREFIX}`;
const DEFAULT_LANGUAGE = "uk";
const LANGUAGES = ["uk", "en", "ru"];
const IMAGE_KEYS = new Set(["image", "imageCard"]);
const IMAGE_PATH = /^[\w-]+(\/[\w.-]+)*\.(webp|png|jpe?g|avif|gif|svg)$/i;

export const COLLECTIONS = ["cases", "articles", "reviews"];
const HAS_LETTERS = /\p{L}/u;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** { uk, en?, ru? } — перекладний рядок */
export const isLocalized = (value) =>
  isPlainObject(value) &&
  typeof value[DEFAULT_LANGUAGE] === "string" &&
  Object.keys(value).every((key) => LANGUAGES.includes(key));

export function readCollection(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const full = path.join(dir, file);
      try {
        return JSON.parse(fs.readFileSync(full, "utf8"));
      } catch (error) {
        throw new Error(`[content] ${full}: некоректний JSON (${error.message})`, { cause: error });
      }
    })
    .sort(
      (a, b) =>
        (a.order ?? 1e9) - (b.order ?? 1e9) ||
        String(a.id).localeCompare(String(b.id)),
    );
}

/** Картинка в даних: при серіалізації стає ідентифікатором імпорту */
class ImageImport {
  constructor(name) {
    this.name = name;
  }
}

/** JS-літерал з даних (рядки — лише через JSON.stringify, імпорти — ідентифікатори) */
function toModuleCode(value) {
  if (value instanceof ImageImport) return value.name;
  if (Array.isArray(value)) return `[${value.map(toModuleCode).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .filter(([k]) => k !== "__proto__")
      .map(([k, v]) => `${JSON.stringify(k)}:${toModuleCode(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Повні дані мовою за замовчуванням; картинки — через колбек imageRef */
export function resolveBase(value, imageRef, key) {
  if (Array.isArray(value)) return value.map((item) => resolveBase(item, imageRef));
  if (isLocalized(value)) return value[DEFAULT_LANGUAGE];
  if (isPlainObject(value)) {
    const result = {};
    for (const [k, v] of Object.entries(value)) result[k] = resolveBase(v, imageRef, k);
    return result;
  }
  if (typeof value === "string" && IMAGE_KEYS.has(key) && value) return imageRef(value);
  return value;
}

/**
 * Лише перекладені рядки мови lang у формі, яку розуміє mergeTranslation:
 * масиви — за індексом (null = без змін), об'єкти — за ключами.
 */
export function resolveOverride(value, lang) {
  if (Array.isArray(value)) {
    const items = value.map((item) => resolveOverride(item, lang));
    return items.some((item) => item !== undefined)
      ? items.map((item) => (item === undefined ? null : item))
      : undefined;
  }
  if (isLocalized(value)) {
    const text = value[lang];
    return typeof text === "string" && text !== "" ? text : undefined;
  }
  if (isPlainObject(value)) {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      const resolved = resolveOverride(v, lang);
      if (resolved !== undefined) result[k] = resolved;
    }
    return Object.keys(result).length ? result : undefined;
  }
  return undefined;
}

/** Чи є рядки без перекладу мовою lang */
export function hasMissing(value, lang) {
  if (Array.isArray(value)) return value.some((item) => hasMissing(item, lang));
  // рядок без літер (цифри, $, %) можна не перекладати
  if (isLocalized(value)) return !value[lang] && HAS_LETTERS.test(value[DEFAULT_LANGUAGE]);
  if (isPlainObject(value)) return Object.values(value).some((item) => hasMissing(item, lang));
  return false;
}

export default function pikaContent() {
  let root = "";
  const dirOf = (collection) => path.join(root, "src/content", collection);

  const generate = (collection, lang) => {
    const items = readCollection(dirOf(collection));

    if (lang !== DEFAULT_LANGUAGE) {
      const overrides = items.map((item) => {
        const override = resolveOverride(item, lang) ?? {};
        // усі тексти перекладено → без плашки «опис поки українською»
        if (!hasMissing(item, lang)) override.fullyTranslated = true;
        return override;
      });
      return `export default ${JSON.stringify(overrides)};`;
    }

    const imports = new Map();
    const imageRef = (relative) => {
      if (!IMAGE_PATH.test(relative) || relative.includes("..")) {
        throw new Error(`[content] ${collection}: некоректний шлях до картинки "${relative}"`);
      }
      const file = path.join(root, "src/assets/images", relative);
      if (!fs.existsSync(file)) {
        throw new Error(`[content] ${collection}: немає файлу src/assets/images/${relative}`);
      }
      if (!imports.has(relative)) imports.set(relative, `__img${imports.size}`);
      return new ImageImport(imports.get(relative));
    };

    const data = items.map((item) => resolveBase(item, imageRef));
    const code = toModuleCode(data);
    const head = [...imports]
      .map(([relative, name]) => `import ${name} from ${JSON.stringify(`/src/assets/images/${relative}`)};`)
      .join("\n");

    return `${head}\nexport default ${code};`;
  };

  return {
    name: "pika-content",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id.startsWith(PREFIX)) return `\0${id}`;
      return null;
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return null;
      const [collection, lang] = id.slice(RESOLVED.length).split("/");
      if (!COLLECTIONS.includes(collection) || !LANGUAGES.includes(lang)) {
        throw new Error(`[content] невідомий модуль ${id}`);
      }
      // dev: зміна будь-якого JSON колекції перебудовує модуль
      this.addWatchFile(dirOf(collection));
      for (const file of fs.readdirSync(dirOf(collection))) {
        this.addWatchFile(path.join(dirOf(collection), file));
      }
      return generate(collection, lang);
    },
    handleHotUpdate({ file, server }) {
      const collection = COLLECTIONS.find((name) => file.startsWith(dirOf(name) + path.sep));
      if (!collection) return;
      for (const lang of LANGUAGES) {
        const module = server.moduleGraph.getModuleById(`${RESOLVED}${collection}/${lang}`);
        if (module) server.moduleGraph.invalidateModule(module);
      }
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
