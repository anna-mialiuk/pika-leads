/**
 * Контент сайту в адмінці: кейси, статті блогу, відгуки.
 *
 * Джерело правди — репозиторій сайту (див. github.mjs і vite-content.js у корені сайту):
 *   src/content/cases/<id>.json, src/content/articles/<id>.json, src/content/reviews/<id>.json
 *   src/content/blog/<мова>/<id>.json — тексти статей
 * Картинки: src/assets/images/... (обкладинки, скриншоти), public/uploads/blog/... (у тексті статей).
 *
 * Збереження = коміт у гілку → GitHub Actions збирає й викладає сайт (2–3 хв).
 */
import crypto from "node:crypto";

import { GITHUB_AUTHOR_EMAIL, SITE_URL } from "./config.mjs";
import { commitFiles, deployStatus, githubConfigured, mapLimit, readBlob, readJsonFile, snapshot } from "./github.mjs";
import { HttpError } from "./http.mjs";

export const LANGS = ["uk", "en", "ru"];
const IMAGE_KEYS = new Set(["image", "imageCard"]);
const IMAGE_PATH = /^[\w-]+(\/[\w.-]+)*\.(webp|png|jpe?g|avif|gif|svg)$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY = /^[A-Za-z][A-Za-z0-9]*$/;
const UPLOAD = /^upload:([\w-]{1,40})$/;
const MAX_STRING = 30_000;
const MAX_IMAGE = 6 * 1024 * 1024;

export const COLLECTIONS = {
  cases: { dir: "src/content/cases", label: "кейс", idType: "slug" },
  articles: { dir: "src/content/articles", label: "статья", idType: "slug" },
  reviews: { dir: "src/content/reviews", label: "отзыв", idType: "number" },
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isLocalized = (value) =>
  isPlainObject(value) && typeof value.uk === "string" && Object.keys(value).every((key) => LANGS.includes(key));

const collectionOr404 = (name) => {
  if (!Object.hasOwn(COLLECTIONS, name)) throw new HttpError(404, "Неизвестный раздел");
  return COLLECTIONS[name];
};

const RESERVED = new Set(["new", "order", "image", "status"]);

function checkId(collection, id) {
  if (RESERVED.has(id)) throw new HttpError(400, "Этот адрес зарезервирован, выберите другой");
  const ok = COLLECTIONS[collection].idType === "number" ? /^[1-9]\d{0,6}$/.test(id) : SLUG.test(id) && id.length <= 80;
  if (!ok) {
    throw new HttpError(
      400,
      COLLECTIONS[collection].idType === "number"
        ? "Некорректный номер"
        : "Адрес (slug): только латиница в нижнем регистре, цифры и дефисы, например «shoe-store-meta»",
    );
  }
}

const filePath = (collection, id) => `${COLLECTIONS[collection].dir}/${id}.json`;
const bodyPath = (lang, id) => `src/content/blog/${lang}/${id}.json`;
const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const textOf = (value) => (isLocalized(value) ? value.uk : typeof value === "string" ? value : "");

/** Чи є неперекладені рядки (так само рахує vite-content.js) */
function missing(value, lang) {
  if (Array.isArray(value)) return value.some((item) => missing(item, lang));
  if (isLocalized(value)) return !value[lang] && /\p{L}/u.test(value.uk); // цифри/символи можна не перекладати
  if (isPlainObject(value)) return Object.values(value).some((item) => missing(item, lang));
  return false;
}

// ---------- читання ----------

async function readCollection(collection) {
  const { dir } = COLLECTIONS[collection];
  const { tree } = await snapshot();
  const paths = [...tree.keys()].filter(
    (path) => path.startsWith(`${dir}/`) && path.endsWith(".json") && !path.slice(dir.length + 1).includes("/"),
  );
  const items = await mapLimit(paths, 8, async (path) => {
    const file = await readJsonFile(path, tree);
    return { ...file, path };
  });
  return items
    .filter((file) => isPlainObject(file.data))
    .sort((a, b) => (a.data.order ?? 1e9) - (b.data.order ?? 1e9) || String(a.data.id).localeCompare(String(b.data.id)));
}

const translated = (item) => ({ en: !missing(item, "en"), ru: !missing(item, "ru") });

function summary(collection, { data: item, sha }, tree) {
  const base = {
    id: item.id,
    sha,
    order: item.order ?? 0,
    status: item.status === "draft" ? "draft" : "published",
    featured: Boolean(item.featured),
    translated: translated(item),
  };
  if (collection === "cases") {
    return {
      ...base,
      title: textOf(item.title),
      category: textOf(item.category),
      categoryColor: item.categoryColor || "",
      source: item.source || "",
      niche: item.niche || "",
      image: item.imageCard || item.image || "",
      public: Boolean(item.image),
      metrics: (item.metrics || []).slice(0, 3).map((m) => ({ label: textOf(m.label), value: textOf(m.value) })),
    };
  }
  if (collection === "articles") {
    return {
      ...base,
      title: textOf(item.title),
      category: textOf(item.category),
      date: item.date || "",
      image: item.image || "",
      bodies: Object.fromEntries(LANGS.map((lang) => [lang, tree.has(bodyPath(lang, item.id))])),
    };
  }
  return { ...base, item };
}

export async function listContent(collection) {
  collectionOr404(collection);
  const files = await readCollection(collection);
  const { tree, sha } = await snapshot();
  return { items: files.map((file) => summary(collection, file, tree)), head: sha };
}

export async function getContent(collection, id) {
  collectionOr404(collection);
  checkId(collection, id);
  const { tree } = await snapshot();
  const file = await readJsonFile(filePath(collection, id), tree);
  if (!file) throw new HttpError(404, "Запись не найдена");

  const result = { item: file.data, sha: file.sha, siteUrl: SITE_URL };
  if (collection === "articles") {
    result.bodies = {};
    for (const lang of LANGS) {
      const body = await readJsonFile(bodyPath(lang, id), tree);
      result.bodies[lang] = body ? { sha: body.sha, blocks: Array.isArray(body.data.blocks) ? body.data.blocks : [] } : null;
    }
  }
  return result;
}

/** Наступний вільний номер відгуку / порядковий номер */
export async function nextNumbers(collection) {
  const files = await readCollection(collection);
  const ids = files.map((f) => Number(f.data.id)).filter(Number.isFinite);
  const orders = files.map((f) => Number(f.data.order)).filter(Number.isFinite);
  const numbers = files.map((f) => Number(f.data.number)).filter(Number.isFinite);
  const originals = files.map((f) => Number(f.data.originalId)).filter(Number.isFinite);
  return {
    id: Math.max(0, ...ids) + 1,
    order: Math.max(-1, ...orders) + 1,
    number: Math.max(0, ...numbers) + 1,
    originalId: Math.max(0, ...originals) + 1,
  };
}

// ---------- картинки ----------

const MIME = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/** Картинка з репозиторію (для прев'ю в адмінці, ще до деплою) */
export async function readImage(path) {
  const allowed =
    (path.startsWith("src/assets/images/") || path.startsWith("public/uploads/")) && IMAGE_PATH.test(path) && !path.includes("..");
  if (!allowed) throw new HttpError(400, "Некорректный путь");
  const { tree } = await snapshot();
  const entry = tree.get(path);
  if (!entry) throw new HttpError(404, "Нет файла");
  const ext = path.split(".").pop().toLowerCase();
  return { buffer: await readBlob(entry.sha), type: MIME[ext], etag: `"${entry.sha}"` };
}

function decodeUpload(value) {
  const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ""));
  if (!match) throw new HttpError(400, "Картинка: ожидается WebP, PNG или JPEG");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_IMAGE) throw new HttpError(413, "Картинка больше 6 МБ — уменьшите её");
  const isWebp = buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP";
  const isPng = buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpeg = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const ext = isWebp ? "webp" : isPng ? "png" : isJpeg ? "jpg" : null;
  if (!ext) throw new HttpError(400, "Файл не похож на картинку");
  return { buffer, ext };
}

const rand = (bytes = 4) => crypto.randomBytes(bytes).toString("hex");

// ---------- перевірка ----------

/**
 * Перевіряє запис і замінює "upload:<key>" на шляхи нових файлів.
 * Повертає очищену копію; нові файли додає в changes.
 */
function cleanItem(value, ctx, path = [], depth = 0) {
  if (depth > 10) throw new HttpError(400, "Слишком глубокая структура");
  const key = path[path.length - 1];
  const where = path.join(".") || "запись";

  if (IMAGE_KEYS.has(key)) {
    if (typeof value !== "string") throw new HttpError(400, `${where}: ожидается картинка`);
    return ctx.image(value, path);
  }

  if (Array.isArray(value)) {
    if (value.length > 300) throw new HttpError(400, `${where}: слишком много элементов`);
    return value.map((item, index) => cleanItem(item, ctx, [...path, index], depth + 1));
  }

  if (isPlainObject(value)) {
    if (Object.keys(value).length && Object.keys(value).every((k) => LANGS.includes(k))) {
      if (!isLocalized(value)) throw new HttpError(400, `${where}: нет украинского текста`);
      const result = {};
      for (const lang of LANGS) {
        if (value[lang] === undefined) continue;
        if (typeof value[lang] !== "string") throw new HttpError(400, `${where}: текст должен быть строкой`);
        if (value[lang].length > MAX_STRING) throw new HttpError(400, `${where}: слишком длинный текст`);
        if (lang === "uk" || value[lang] !== "") result[lang] = value[lang];
      }
      return result;
    }
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      if (!KEY.test(k)) throw new HttpError(400, `${where}: недопустимое поле «${k}»`);
      if (v === undefined || v === null) continue;
      const cleaned = cleanItem(v, ctx, [...path, k], depth + 1);
      // порожнє необов'язкове поле (усі мови пусті) — не зберігаємо
      if (isLocalized(cleaned) && cleaned.uk === "" && Object.keys(cleaned).length === 1) continue;
      result[k] = cleaned;
    }
    return result;
  }

  if (typeof value === "string") {
    if (value.length > MAX_STRING) throw new HttpError(400, `${where}: слишком длинный текст`);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new HttpError(400, `${where}: некорректное число`);
    return value;
  }
  if (typeof value === "boolean") return value;
  throw new HttpError(400, `${where}: недопустимое значение`);
}

/** Куди класти нову картинку поля */
function imageTarget(collection, id, path) {
  const top = path.length === 1;
  if (collection === "cases") {
    if (top && path[0] === "image") return `cases/${id}-${rand()}`;
    if (top && path[0] === "imageCard") return `cases/card/${id}-${rand()}`;
    return `cases/content/${id}/${rand(5)}`;
  }
  if (collection === "articles") return `blog/${id}-${rand()}`;
  return `reviews/${id}-${rand()}`;
}

const BLOCK_TYPES = new Set(["heading", "paragraph", "list", "note", "code", "image"]);

function cleanBlocks(blocks, lang, ctx) {
  if (!Array.isArray(blocks)) throw new HttpError(400, `Текст статьи (${lang}): ожидается список блоков`);
  if (blocks.length > 1000) throw new HttpError(400, `Текст статьи (${lang}): слишком много блоков`);
  const str = (value, where, required = false) => {
    if (value === undefined || value === null || value === "") {
      if (required) throw new HttpError(400, `${where}: пустой текст`);
      return undefined;
    }
    if (typeof value !== "string" || value.length > MAX_STRING) throw new HttpError(400, `${where}: некорректный текст`);
    return value;
  };
  return blocks.map((block, index) => {
    const where = `Текст статьи (${lang.toUpperCase()}), блок ${index + 1}`;
    if (!isPlainObject(block) || !BLOCK_TYPES.has(block.type)) throw new HttpError(400, `${where}: неизвестный тип блока`);
    switch (block.type) {
      case "heading": {
        const level = block.level === 3 ? 3 : 2;
        const id = block.id ? String(block.id) : "";
        if (id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new HttpError(400, `${where}: якорь — латиница, цифры и дефисы`);
        return { type: "heading", level, ...(id ? { id } : {}), text: str(block.text, where, true) };
      }
      case "paragraph":
        return { type: "paragraph", text: str(block.text, where, true) };
      case "list": {
        const items = Array.isArray(block.items) ? block.items.map((item) => str(item, where, true)) : [];
        if (!items.length) throw new HttpError(400, `${where}: пустой список`);
        return { type: "list", style: block.style === "ordered" ? "ordered" : "unordered", items };
      }
      case "note":
        return { type: "note", ...(block.variant === "warning" ? { variant: "warning" } : {}), text: str(block.text, where, true) };
      case "code":
        return { type: "code", code: str(block.code, where, true) };
      case "image": {
        const src = ctx.bodyImage(String(block.src || ""), where);
        const alt = str(block.alt, where);
        const caption = str(block.caption, where);
        return { type: "image", src, ...(alt ? { alt } : {}), ...(caption ? { caption } : {}) };
      }
      default:
        throw new HttpError(400, `${where}: неизвестный тип блока`);
    }
  });
}

// ---------- запис ----------

const ORDER_FIELDS = ["order", "id"];

/** Поля в зручному порядку: службові — зверху */
const ordered = (item) => {
  const result = {};
  for (const key of ORDER_FIELDS) if (key in item) result[key] = item[key];
  for (const [key, value] of Object.entries(item)) if (!(key in result)) result[key] = value;
  return result;
};

const authorOf = (user) => ({ name: `${user.name} (админка)`, email: GITHUB_AUTHOR_EMAIL });

export async function saveContent(collection, id, body, user) {
  const config = collectionOr404(collection);
  checkId(collection, id);
  if (!isPlainObject(body) || !isPlainObject(body.item)) throw new HttpError(400, "Нет данных записи");

  const isNew = body.sha === null || body.sha === undefined;
  const { tree } = await snapshot({ force: true });
  const uploads = isPlainObject(body.uploads) ? body.uploads : {};
  if (Object.keys(uploads).length > 40) throw new HttpError(400, "Слишком много картинок за раз");

  const changes = [];
  const used = new Map();
  /** Нова картинка: файл додається до коміту один раз, повертається шлях */
  const takeUpload = (key, folder, root, where) => {
    const usedKey = `${root}:${key}`;
    if (used.has(usedKey)) return used.get(usedKey);
    if (!Object.hasOwn(uploads, key)) throw new HttpError(400, `${where}: картинка не загружена`);
    const { buffer, ext } = decodeUpload(uploads[key]);
    const target = `${folder}.${ext}`;
    changes.push({ path: `${root}/${target}`, content: buffer });
    used.set(usedKey, target);
    return target;
  };

  const ctx = {
    image(value, path) {
      const where = path.join(".");
      if (value === "") return "";
      const upload = UPLOAD.exec(value);
      if (upload) return takeUpload(upload[1], imageTarget(collection, id, path), "src/assets/images", where);
      if (!IMAGE_PATH.test(value) || value.includes("..") || !tree.has(`src/assets/images/${value}`)) {
        throw new HttpError(400, `${where}: нет картинки ${value}`);
      }
      return value;
    },
    bodyImage(value, where) {
      const upload = UPLOAD.exec(value);
      if (upload) return `/${takeUpload(upload[1], `uploads/blog/${id}/${rand(5)}`, "public", where)}`;
      if (/^\/uploads\/[\w./-]+$/.test(value) && !value.includes("..")) return value;
      if (/^https:\/\/[^\s"'<>]+$/.test(value)) return value;
      throw new HttpError(400, `${where}: укажите картинку`);
    },
  };

  // запис
  const item = cleanItem(body.item, ctx);
  // службові поля сайту задає сервер (адреса сторінки, позначка перекладу)
  delete item.slug;
  delete item.href;
  delete item.fullyTranslated;
  item.id = config.idType === "number" ? Number(id) : id;
  if (item.status !== "draft") delete item.status;
  if (!Number.isFinite(item.order)) item.order = (await nextNumbers(collection)).order;
  if (collection === "articles") item.href = `/blog/${id}`;
  if (collection === "cases" && !textOf(item.title).trim()) throw new HttpError(400, "Заполните заголовок (UA)");
  if (collection === "articles" && !textOf(item.title).trim()) throw new HttpError(400, "Заполните заголовок (UA)");
  if (collection === "reviews" && !textOf(item.text).trim()) throw new HttpError(400, "Заполните текст отзыва (UA)");

  const path = filePath(collection, id);
  const expect = { [path]: isNew ? null : String(body.sha) };
  changes.push({ path, content: toJson(ordered(item)) });

  // тексти статей
  if (collection === "articles" && isPlainObject(body.bodies)) {
    for (const lang of LANGS) {
      if (!Object.hasOwn(body.bodies, lang)) continue;
      const entry = body.bodies[lang];
      const target = bodyPath(lang, id);
      const exists = tree.get(target)?.sha ?? null;
      if (!isPlainObject(entry)) throw new HttpError(400, "Некорректный текст статьи");
      if (entry.delete === true) {
        if (lang === "uk") throw new HttpError(400, "Украинский текст статьи удалить нельзя");
        if (exists) {
          expect[target] = entry.sha ? String(entry.sha) : exists;
          changes.push({ path: target, content: null });
        }
        continue;
      }
      expect[target] = entry.sha ? String(entry.sha) : null;
      changes.push({ path: target, content: toJson({ id, blocks: cleanBlocks(entry.blocks, lang, ctx) }) });
    }
    if (isNew && !changes.some((c) => c.path === bodyPath("uk", id))) {
      changes.push({ path: bodyPath("uk", id), content: toJson({ id, blocks: [] }) });
      expect[bodyPath("uk", id)] = null;
    }
  }

  const title = textOf(item.title || item.name).slice(0, 60);
  const result = await commitFiles({
    changes,
    expect,
    message: `Админка: ${config.label} «${title || id}» — ${isNew ? "добавлен(а)" : "изменён(а)"}\n\n${collection}/${id}, ${user.name}`,
    author: authorOf(user),
  });
  const fresh = await getContent(collection, id);
  return { ...fresh, commit: result };
}

export async function deleteContent(collection, id, sha, user) {
  const config = collectionOr404(collection);
  checkId(collection, id);
  if (!sha) throw new HttpError(400, "Нет версии записи");
  const { tree } = await snapshot({ force: true });
  const path = filePath(collection, id);
  const changes = [{ path, content: null }];
  const expect = { [path]: String(sha) };
  if (collection === "articles") {
    for (const lang of LANGS) {
      if (tree.has(bodyPath(lang, id))) changes.push({ path: bodyPath(lang, id), content: null });
    }
  }
  return commitFiles({
    changes,
    expect,
    message: `Админка: ${config.label} ${collection}/${id} — удалён(а)\n\n${user.name}`,
    author: authorOf(user),
  });
}

/** Новий порядок записів: ids — у потрібному порядку */
export async function reorderContent(collection, ids, user) {
  const config = collectionOr404(collection);
  if (!Array.isArray(ids) || ids.length > 1000) throw new HttpError(400, "Некорректный порядок");
  const files = await readCollection(collection);
  const byId = new Map(files.map((file) => [String(file.data.id), file]));
  const wanted = ids.map(String).filter((id) => byId.has(id));
  // записи, яких немає в списку (хтось додав щойно), — у кінець
  for (const file of files) if (!wanted.includes(String(file.data.id))) wanted.push(String(file.data.id));

  const changes = [];
  const expect = {};
  wanted.forEach((id, index) => {
    const file = byId.get(id);
    if (file.data.order === index) return;
    changes.push({ path: file.path, content: toJson(ordered({ ...file.data, order: index })) });
    expect[file.path] = file.sha;
  });
  if (!changes.length) return { unchanged: true };
  return commitFiles({
    changes,
    expect,
    message: `Админка: новый порядок — ${config.label}\n\n${user.name}`,
    author: authorOf(user),
  });
}

export async function contentStatus() {
  if (!githubConfigured()) return { configured: false, siteUrl: SITE_URL };
  const { sha } = await snapshot();
  return { configured: true, head: sha, siteUrl: SITE_URL, deploy: await deployStatus() };
}

// ---------- SEO сторінок (src/content/seo.json) ----------

const SEO_FILE = "src/content/seo.json";
const SEO_PAGE = /^\/[a-z0-9/-]{0,200}$/;
const SEO_MAX = { title: 200, description: 500 };

export async function getSeo() {
  const { tree } = await snapshot();
  const file = await readJsonFile(SEO_FILE, tree);
  return { data: isPlainObject(file?.data) ? file.data : {}, sha: file?.sha ?? null };
}

function cleanSeoEntry(entry) {
  if (entry === null) return null;
  if (!isPlainObject(entry)) throw new HttpError(400, "Некорректные данные SEO");
  const result = {};
  for (const key of ["title", "description"]) {
    const value = entry[key];
    if (value === undefined || value === null) continue;
    if (!isPlainObject(value)) throw new HttpError(400, `SEO: ${key} — ожидается текст по языкам`);
    const texts = {};
    for (const lang of LANGS) {
      const text = value[lang];
      if (text === undefined || text === null || text === "") continue;
      if (typeof text !== "string" || text.length > SEO_MAX[key]) throw new HttpError(400, `SEO: слишком длинный ${key === "title" ? "заголовок" : "текст описания"}`);
      texts[lang] = text.trim();
    }
    if (Object.keys(texts).length) result[key] = texts;
  }
  if (entry.noindex === true) result.noindex = true;
  return Object.keys(result).length ? result : null;
}

/** Змінює SEO однієї сторінки; before — запис, який бачив користувач (для перевірки конфлікту) */
export async function saveSeoPage(body, user) {
  if (!isPlainObject(body)) throw new HttpError(400, "Нет данных");
  const page = String(body.path || "");
  if (!SEO_PAGE.test(page) || page.includes("//")) throw new HttpError(400, "Некорректный адрес страницы");
  const entry = cleanSeoEntry(body.entry ?? null);

  await snapshot({ force: true });
  const { data, sha } = await getSeo();
  const current = Object.hasOwn(data, page) ? data[page] : null;
  if (JSON.stringify(current ?? null) !== JSON.stringify(body.before ?? null)) {
    throw new HttpError(409, "SEO этой страницы уже изменили. Обновите страницу");
  }
  const next = { ...data };
  if (entry) next[page] = entry;
  else delete next[page];
  const sorted = Object.fromEntries(Object.keys(next).sort().map((key) => [key, next[key]]));

  const commit = await commitFiles({
    changes: [{ path: SEO_FILE, content: toJson(sorted) }],
    expect: { [SEO_FILE]: sha },
    message: `Админка: SEO ${page} — ${entry ? "изменено" : "сброшено"}\n\n${user.name}`,
    author: authorOf(user),
  });
  return { entry, commit };
}

// ---------- перевірка сторінок сайту (як їх бачить Google) ----------

const decodeHtml = (text) =>
  String(text || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

const metaContent = (html, attr, name) => {
  const tag = html.match(new RegExp(`<meta[^>]*${attr}="${name}"[^>]*>`, "i"))?.[0];
  return tag ? decodeHtml(tag.match(/content="([^"]*)"/i)?.[1]) : null;
};

function parsePage(html) {
  return {
    title: decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),
    description: metaContent(html, "name", "description"),
    robots: metaContent(html, "name", "robots"),
    ogImage: metaContent(html, "property", "og:image"),
    canonical: decodeHtml(html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i)?.[1]),
    h1: (html.match(/<h1[\s>]/gi) || []).length,
  };
}

let auditCache = null;
let auditRunning = null;

export async function seoAudit({ refresh = false } = {}) {
  if (auditCache && !refresh && Date.now() - auditCache.at < 10 * 60 * 1000) return auditCache;
  if (auditRunning) return auditRunning;

  auditRunning = (async () => {
    const get = async (url) => {
      const response = await fetch(url, { headers: { "User-Agent": "PikaleadsSeoCheck/1.0" }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    };
    let sitemap;
    try {
      sitemap = await get(`${SITE_URL}/sitemap.xml`);
    } catch (error) {
      throw new HttpError(502, `Не удалось открыть ${SITE_URL}/sitemap.xml (${error.message})`);
    }
    const urls = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()))]
      .filter((url) => url.startsWith(SITE_URL))
      .slice(0, 1000);

    const pages = await mapLimit(urls, 6, async (url) => {
      try {
        return { url, ...parsePage(await get(url)) };
      } catch (error) {
        return { url, error: error.message };
      }
    });
    auditCache = { at: Date.now(), siteUrl: SITE_URL, pages };
    return auditCache;
  })().finally(() => {
    auditRunning = null;
  });
  return auditRunning;
}
