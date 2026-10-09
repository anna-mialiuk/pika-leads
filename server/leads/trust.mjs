/**
 * Траст соц-профілів Meta: оцінка довіри до бізнес-сторінки + черга контенту на прогрів.
 *
 * Сигнали (0–100) виставляє байєр за чек-листом; підсумковий бал — зважене середнє.
 * Контент генерує AI (Claude) лише як чернетки: публікує людина вручну після схвалення,
 * у чергу записується, що опубліковано.
 */
import crypto from "node:crypto";

import { aiJson, aiReady } from "./ai.mjs";
import { HttpError } from "./http.mjs";
import { cabinets } from "./ads.mjs";
import { createCollection } from "./store.mjs";
import { clean } from "./telegram.mjs";

export const pages = createCollection("meta-pages.json");

export const SIGNALS = { profile: 0.2, activity: 0.2, reviews: 0.15, media: 0.15, contacts: 0.15, history: 0.15 };
const TYPES = ["post", "profile", "media"];
const now = () => new Date().toISOString();

export const trustScore = (signals = {}) =>
  Math.round(Object.entries(SIGNALS).reduce((sum, [key, weight]) => sum + (Number(signals[key]) || 0) * weight, 0));

export const publicPage = (p) => ({
  id: p.id,
  name: p.name,
  handle: p.handle,
  followers: p.followers,
  cabinetId: p.cabinetId,
  signals: p.signals,
  score: trustScore(p.signals),
  autoWarm: Boolean(p.autoWarm),
  queue: (p.queue || []).filter((q) => q.status !== "rejected").slice(-30),
  createdAt: p.createdAt,
});

export const listPages = () => pages.filter((p) => !p.deleted).map(publicPage);

function cleanPage(body) {
  const out = {};
  if ("name" in body) {
    out.name = clean(body.name, 80);
    if (!out.name) throw new HttpError(400, "Укажите название страницы");
  }
  if ("handle" in body) out.handle = clean(body.handle, 60);
  if ("followers" in body) {
    const n = Number(body.followers || 0);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new HttpError(400, "Некорректное число подписчиков");
    out.followers = Math.round(n);
  }
  if ("cabinetId" in body) {
    const id = body.cabinetId ? Number(body.cabinetId) : null;
    if (id && !cabinets.get(id)) throw new HttpError(400, "Кабинет не найден");
    out.cabinetId = id;
  }
  if (body.signals && typeof body.signals === "object") {
    out.signals = {};
    for (const key of Object.keys(SIGNALS)) {
      const v = Number(body.signals[key] ?? 0);
      if (!Number.isFinite(v) || v < 0 || v > 100) throw new HttpError(400, "Сигналы — от 0 до 100");
      out.signals[key] = Math.round(v);
    }
  }
  if ("autoWarm" in body) out.autoWarm = Boolean(body.autoWarm);
  return out;
}

export function createPage(body, user) {
  const data = cleanPage({ signals: {}, ...body });
  if (!data.name) throw new HttpError(400, "Укажите название страницы");
  return publicPage(pages.insert({ handle: "", followers: 0, cabinetId: null, autoWarm: false, ...data, queue: [], createdAt: now(), createdBy: { userId: user.id, name: user.name } }));
}

export function updatePage(id, body) {
  const page = pageOr404(id);
  return publicPage(pages.update(page.id, (p) => Object.assign(p, cleanPage(body), { updatedAt: now() })));
}

export function deletePage(id) {
  const page = pageOr404(id);
  pages.update(page.id, (p) => {
    p.deleted = true;
  });
}

function pageOr404(id) {
  const page = pages.get(id);
  if (!page || page.deleted) throw new HttpError(404, "Страница не найдена");
  return page;
}

const SIGNAL_NAMES = { profile: "заполненность профиля", activity: "активность и постинг", reviews: "отзывы и оценки", media: "качество медиа", contacts: "контакты и верификация", history: "история аккаунта" };

/** AI генерує 3 чернетки під найслабші сигнали */
export async function generateContent(id, lang = "ru") {
  if (!aiReady()) throw new HttpError(400, "AI не подключён: добавьте ANTHROPIC_API_KEY в .env сервера");
  const page = pageOr404(id);
  const weak = Object.entries(page.signals || {})
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([k, v]) => `${SIGNAL_NAMES[k]}: ${v}/100`);
  const cab = page.cabinetId ? cabinets.get(page.cabinetId) : null;
  const items = await aiJson({
    lang,
    system: "Ты помогаешь прогревать бизнес-страницу в Facebook/Instagram, чтобы повысить доверие Meta перед запуском рекламы. Контент должен быть честным, без обещаний гарантированного дохода и без вводящих в заблуждение утверждений.",
    prompt: [
      `Страница: ${page.name}${page.handle ? ` (${page.handle})` : ""}, подписчиков: ${page.followers || 0}.`,
      cab?.niche ? `Ниша: ${cab.niche}.` : "",
      `Самые слабые сигналы траста: ${weak.join("; ")}.`,
      'Придумай 3 элемента контента, которые закроют слабые места. Формат: [{"type":"post|profile|media","title":"кратко, до 70 символов","preview":"готовый текст поста или что заполнить, до 300 символов"}].',
    ]
      .filter(Boolean)
      .join("\n"),
  });
  const list = (Array.isArray(items) ? items : [])
    .filter((x) => x && TYPES.includes(x.type))
    .slice(0, 5)
    .map((x) => ({ id: crypto.randomUUID(), type: x.type, title: clean(x.title, 120), preview: clean(x.preview, 1200), status: "pending", createdAt: now() }));
  if (!list.length) throw new HttpError(502, "AI не предложил контент — попробуйте ещё раз");
  return publicPage(
    pages.update(page.id, (p) => {
      p.queue = [...(p.queue || []), ...list];
      p.lastGeneratedAt = now();
    }),
  );
}

export function setQueueStatus(id, itemId, status, user) {
  if (!["approved", "rejected", "published", "pending"].includes(status)) throw new HttpError(400, "Неизвестный статус");
  const page = pageOr404(id);
  const item = (page.queue || []).find((q) => q.id === itemId);
  if (!item) throw new HttpError(404, "Элемент не найден");
  return publicPage(
    pages.update(page.id, (p) => {
      const q = p.queue.find((x) => x.id === itemId);
      q.status = status;
      q[`${status}At`] = now();
      q.by = { userId: user.id, name: user.name };
    }),
  );
}

/** Позначити всі схвалені як опубліковані (після ручної публікації) */
export function publishApproved(user) {
  let count = 0;
  for (const page of pages.filter((p) => !p.deleted)) {
    if (!(page.queue || []).some((q) => q.status === "approved")) continue;
    pages.update(page.id, (p) => {
      for (const q of p.queue) {
        if (q.status === "approved") {
          q.status = "published";
          q.publishedAt = now();
          q.by = { userId: user.id, name: user.name };
          count += 1;
        }
      }
    });
  }
  return count;
}

/** Авто-прогрів: раз на тиждень нові чернетки для сторінок із низьким трастом */
export async function autoWarm() {
  if (!aiReady()) return;
  const week = 7 * 86_400_000;
  for (const page of pages.filter((p) => !p.deleted && p.autoWarm)) {
    const pending = (page.queue || []).filter((q) => q.status === "pending").length;
    const fresh = page.lastGeneratedAt && Date.now() - new Date(page.lastGeneratedAt).getTime() < week;
    if (trustScore(page.signals) >= 70 || pending >= 2 || fresh) continue;
    try {
      await generateContent(page.id);
    } catch (error) {
      console.error("[trust]", error.message);
    }
  }
}
