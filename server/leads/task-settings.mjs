/**
 * Налаштування розділу «Задачи» (сторінка «Настройки»), зберігаються в settings.json → tasks:
 *   колонки канбана, постановка задач через Telegram (/task), постійні кімнати відеозв'язку,
 *   які сповіщення надсилати в Telegram.
 */
import crypto from "node:crypto";

import { HttpError } from "./http.mjs";
import { readJson, writeJson } from "./store.mjs";

const SETTINGS_FILE = "settings.json";

/** Вбудовані колонки: «Готово» і «Отклонено» — закриті (без нагадувань) */
export const DEFAULT_COLUMNS = [
  { key: "todo", label: "To Do", color: "#8a8f98" },
  { key: "inprogress", label: "В работе", color: "#FFC629" },
  { key: "review", label: "На проверке", color: "#5b9bff" },
  { key: "consideration", label: "На рассмотрении", color: "#b98bff" },
  { key: "done", label: "Готово", color: "#4fd88a", closed: true },
  { key: "rejected", label: "Отклонено", color: "#ff7d7d", closed: true },
];
export const COLUMN_COLORS = ["#8a8f98", "#5b9bff", "#FFC629", "#f0883e", "#4fd88a", "#ff7d7d", "#b98bff", "#4fd8c8"];
// без цих двох ключів не працюють нагадування й кнопка «✅ Готово»
export const REQUIRED_COLUMNS = ["todo", "done"];
const CLOSED_KEYS = new Set(["done", "rejected"]);

const VIDEO_KEYS = ["zoom", "googlemeet", "loom"];

const DEFAULTS = {
  columns: DEFAULT_COLUMNS,
  telegramCreate: true,
  notify: { enabled: true, assign: true, deadline: true, overdue: true, comment: true },
  video: { zoom: { link: "" }, googlemeet: { link: "" }, loom: { link: "" } },
  autoLink: true,
};

let cache = null;

export function getTaskSettings() {
  if (cache) return cache;
  const stored = readJson(SETTINGS_FILE, {}).tasks || {};
  const columns = Array.isArray(stored.columns) && stored.columns.length ? stored.columns : DEFAULTS.columns;
  cache = {
    ...DEFAULTS,
    ...stored,
    columns: columns.map((c) => ({ ...c, closed: CLOSED_KEYS.has(c.key) })),
    notify: { ...DEFAULTS.notify, ...(stored.notify || {}) },
    video: Object.fromEntries(VIDEO_KEYS.map((k) => [k, { link: stored.video?.[k]?.link || "" }])),
  };
  return cache;
}

export const columnKeys = () => getTaskSettings().columns.map((c) => c.key);
export const isClosedStatus = (key) => CLOSED_KEYS.has(key);
export const columnLabel = (key) => getTaskSettings().columns.find((c) => c.key === key)?.label || key;
export const notifyOn = (kind) => {
  const n = getTaskSettings().notify;
  return n.enabled && n[kind] !== false;
};

const cleanText = (value, max) => String(value ?? "").trim().slice(0, max);

/**
 * Зберегти налаштування (лише адміністратор). Повертає { settings, removed } —
 * ключі видалених колонок, задачі з яких треба перенести в «To Do».
 */
export function saveTaskSettings(body) {
  const current = getTaskSettings();
  const next = { ...current };

  if ("columns" in body) {
    if (!Array.isArray(body.columns) || body.columns.length < 2 || body.columns.length > 12) {
      throw new HttpError(400, "Колонок должно быть от 2 до 12");
    }
    const seen = new Set();
    next.columns = body.columns.map((c) => {
      const label = cleanText(c?.label, 40);
      if (!label) throw new HttpError(400, "У каждой колонки должно быть название");
      let key = cleanText(c?.key, 40);
      // нова колонка — генеруємо ключ
      if (!key || !/^[a-z0-9_-]+$/.test(key)) key = `col_${crypto.randomBytes(4).toString("hex")}`;
      if (seen.has(key)) throw new HttpError(400, "Повторяющаяся колонка");
      seen.add(key);
      return { key, label, color: COLUMN_COLORS.includes(c?.color) ? c.color : "#8a8f98", closed: CLOSED_KEYS.has(key) };
    });
    for (const key of REQUIRED_COLUMNS) {
      if (!seen.has(key)) throw new HttpError(400, `Колонку «${current.columns.find((c) => c.key === key)?.label || key}» удалить нельзя`);
    }
  }
  if ("telegramCreate" in body) next.telegramCreate = Boolean(body.telegramCreate);
  if ("autoLink" in body) next.autoLink = Boolean(body.autoLink);
  if (body.notify && typeof body.notify === "object") {
    next.notify = { ...current.notify };
    for (const k of Object.keys(DEFAULTS.notify)) if (k in body.notify) next.notify[k] = Boolean(body.notify[k]);
  }
  if (body.video && typeof body.video === "object") {
    next.video = { ...current.video };
    for (const k of VIDEO_KEYS) {
      if (!(k in body.video)) continue;
      const link = cleanText(body.video[k]?.link, 500);
      if (link && !/^https:\/\/[^\s"'<>]+$/i.test(link)) throw new HttpError(400, "Ссылка на комнату должна начинаться с https://");
      next.video[k] = { link };
    }
  }

  const removed = current.columns.map((c) => c.key).filter((k) => !next.columns.some((c) => c.key === k));
  const all = readJson(SETTINGS_FILE, {});
  writeJson(SETTINGS_FILE, { ...all, tasks: { ...next, columns: next.columns.map(({ key, label, color }) => ({ key, label, color })) } });
  cache = null;
  return { settings: getTaskSettings(), removed };
}
