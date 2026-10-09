import { t } from "./i18n";
/**
 * Хелпери контенту сайту: перекладні рядки { uk, en, ru }, шляхи до полів,
 * картинки (конвертація в WebP прямо в браузері), чернетки в localStorage.
 */
export const LANGS = [
  { code: "uk", label: "UA" },
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

export const isLocalized = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof value.uk === "string" &&
  Object.keys(value).every((key) => key === "uk" || key === "en" || key === "ru");

/** Текст мовою lang (без запасного варіанту) */
export const locText = (value, lang) => {
  if (isLocalized(value)) return value[lang] ?? "";
  if (typeof value === "string") return lang === "uk" ? value : "";
  return "";
};

export const setLocText = (value, lang, text) => {
  const base = isLocalized(value) ? value : { uk: typeof value === "string" ? value : "" };
  const next = { ...base, [lang]: text };
  if (lang !== "uk" && text === "") delete next[lang];
  return next;
};

// ---------- шляхи до вкладених полів ----------

export const getIn = (object, path) => path.reduce((value, key) => (value == null ? undefined : value[key]), object);

export function setIn(object, path, value) {
  if (!path.length) return value;
  const [key, ...rest] = path;
  const copy = Array.isArray(object) ? [...object] : { ...(object || {}) };
  const next = setIn(copy[key], rest, value);
  if (next === undefined && !Array.isArray(copy)) delete copy[key];
  else copy[key] = next;
  return copy;
}

/** Скільки рядків без перекладу мовою lang */
export function countMissing(value, lang) {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countMissing(item, lang), 0);
  // рядок без літер (цифри, $, %) можна не перекладати — на сайті покажеться як є
  if (isLocalized(value)) return value.uk && !value[lang] && /\p{L}/u.test(value.uk) ? 1 : 0;
  if (value && typeof value === "object") return Object.values(value).reduce((sum, item) => sum + countMissing(item, lang), 0);
  return 0;
}

/** Текст статті: кількість неперекладених блоків */
export const titleOf = (item) => locText(item?.title, "uk") || locText(item?.name, "uk") || "";

// ---------- картинки ----------

export const imageUrl = (path) =>
  path
    ? `/api/admin/content/image?path=${encodeURIComponent(path.startsWith("/uploads/") ? `public${path}` : `src/assets/images/${path}`)}`
    : "";

/** Прев'ю: нова (ще не збережена) картинка — з пам'яті, інакше — з репозиторію */
export const previewOf = (value, uploads) => {
  const match = /^upload:(.+)$/.exec(value || "");
  if (match) return uploads[match[1]] || "";
  return imageUrl(value);
};

let uploadCounter = 0;
export const uploadKey = () => `u${Date.now().toString(36)}${(uploadCounter += 1)}`;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t("Не удалось открыть картинку")));
    };
    image.src = url;
  });
}

const canvasToDataUrl = (canvas, quality) => {
  const data = canvas.toDataURL("image/webp", quality);
  // Safari без WebP-кодера віддає PNG — тоді JPEG (менший)
  return data.startsWith("data:image/webp") ? data : canvas.toDataURL("image/jpeg", quality);
};

/**
 * Картинка → WebP data URL.
 *   maxWidth / maxHeight — зменшити до цих розмірів (без збільшення)
 *   crop: [w, h] — обрізати по центру точно до цього розміру (як object-fit: cover)
 */
export async function convertImage(file, { maxWidth = 1800, maxHeight = 2400, crop = null, quality = 0.82 } = {}) {
  if (!file.type.startsWith("image/")) throw new Error(t("Это не картинка"));
  if (file.size > 30 * 1024 * 1024) throw new Error(t("Файл больше 30 МБ"));
  const { image, url } = await loadImage(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const { naturalWidth: w, naturalHeight: h } = image;
    if (crop) {
      const [cw, ch] = crop;
      const scale = Math.max(cw / w, ch / h);
      const sw = cw / scale;
      const sh = ch / scale;
      canvas.width = cw;
      canvas.height = ch;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, cw, ch);
    } else {
      const scale = Math.min(1, maxWidth / w, maxHeight / h);
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    return canvasToDataUrl(canvas, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Пресети розмірів (як у наявних картинок сайту) */
export const IMAGE_PRESETS = {
  caseCover: { maxWidth: 1400 },
  caseCard: { crop: [840, 368] },
  screenshot: { maxWidth: 1800, maxHeight: 2400 },
  blogCover: { crop: [1200, 675] },
  blogBody: { maxWidth: 1400 },
};

/** Розмір data URL у КБ */
export const dataUrlSize = (dataUrl) => Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4 / 1024);

// ---------- чернетки (незбережені правки переживають перезавантаження) ----------

const draftKey = (collection, id) => `pika-draft:${collection}:${id}`;

export function saveDraft(collection, id, draft) {
  try {
    localStorage.setItem(draftKey(collection, id), JSON.stringify({ ...draft, savedAt: Date.now() }));
    return true;
  } catch {
    return false; // переповнено (великі картинки) або заборонено
  }
}

export function loadDraft(collection, id) {
  try {
    const raw = localStorage.getItem(draftKey(collection, id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(collection, id) {
  try {
    localStorage.removeItem(draftKey(collection, id));
  } catch {
    /* немає доступу до сховища */
  }
}

/** Адреса з назви: «Магазин взуття» → «magazyn-vzuttia» */
const TRANSLIT = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ie",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "iu",
  я: "ia",
  ы: "y",
  э: "e",
  ё: "e",
  ъ: "",
};

export const slugify = (text) =>
  String(text || "")
    .toLowerCase()
    .split("")
    .map((char) => (Object.hasOwn(TRANSLIT, char) ? TRANSLIT[char] : char))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

/** Перед збереженням: прибрати порожні блоки та порожні пункти списків */
export const cleanBlocks = (blocks) =>
  blocks
    .map((block) => (block.type === "list" ? { ...block, items: block.items.map((s) => s.trim()).filter(Boolean) } : block))
    .filter((block) => {
      if (block.type === "list") return block.items.length > 0;
      if (block.type === "code") return Boolean(block.code?.trim());
      if (block.type === "image") return Boolean(block.src);
      return Boolean(block.text?.trim());
    });

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Тристороннє злиття: base — версія, з якої почали правити, mine — наші правки,
 * theirs — актуальна версія з сервера. Беремо наші зміни лише там, де ми щось
 * міняли; решта — як на сервері (чужі правки не губляться).
 */
export function merge3(base, mine, theirs) {
  if (sameValue(mine, base)) return theirs;
  if (sameValue(theirs, base) || sameValue(mine, theirs)) return mine;
  if (isObject(base) && isObject(mine) && isObject(theirs)) {
    const result = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)])) {
      const value = merge3(base[key], mine[key], theirs[key]);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  if (Array.isArray(base) && Array.isArray(mine) && Array.isArray(theirs) && base.length === mine.length && mine.length === theirs.length) {
    return mine.map((value, index) => merge3(base[index], value, theirs[index]));
  }
  return mine; // змінили обидва — перемагають наші правки
}

/** Посилання на нові картинки, яких уже немає (чернетка без картинок) → порожньо */
export function dropMissingUploads(value, uploads) {
  let dropped = 0;
  const walk = (node) => {
    if (typeof node === "string") {
      const match = /^upload:(.+)$/.exec(node);
      if (match && !uploads[match[1]]) {
        dropped += 1;
        return "";
      }
      return node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (isObject(node)) return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    return node;
  };
  return { value: walk(value), dropped };
}
