/**
 * UTM-конструктор і скорочувач посилань.
 *
 * Коротке посилання: SHORT_LINK_BASE/<код> (за замовчуванням https://pika-leads.com/go/<код>).
 * Nginx сайту проксіює /go/ на цей сервіс; сервіс рахує перехід і робить 302 на повну адресу,
 * додаючи pl=<код> — так заявка з сайту (attribution.landingPage) точно прив'язується до посилання.
 */
import crypto from "node:crypto";

import { SHORT_LINK_BASE, SITE_URL } from "./config.mjs";
import { HttpError } from "./http.mjs";
import { createCollection } from "./store.mjs";
import { clean } from "./telegram.mjs";
import { dayKey } from "./ads.mjs";

export const links = createCollection("short-links.json");

const PLATFORMS = ["meta", "google", "tiktok", "manual"];
const CODE_RE = /^[a-z0-9-]{3,32}$/;
const now = () => new Date().toISOString();

const fullUrl = (l) => `${l.base}${l.params ? `?${l.params}` : ""}`;

export const publicLink = (l) => ({
  id: l.id,
  code: l.code,
  title: l.title,
  base: l.base,
  params: l.params,
  platform: l.platform,
  short: `${SHORT_LINK_BASE}/${l.code}`,
  full: fullUrl(l),
  clicks: l.clicks || 0,
  byDay: l.byDay || {},
  refs: l.refs || {},
  createdAt: l.createdAt,
  createdBy: l.createdBy,
  lastClickAt: l.lastClickAt || null,
});

export const listLinks = () => links.filter((l) => !l.deleted).sort((a, b) => b.id - a.id).map(publicLink);

function randomCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = crypto.randomBytes(4).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
    if (code.length >= 5 && !links.find((l) => l.code === code)) return code;
  }
  throw new HttpError(500, "Не удалось подобрать код");
}

export function createLink(body, user) {
  let base;
  try {
    const url = new URL(String(body.base || "").trim());
    if (!/^https?:$/.test(url.protocol)) throw new Error();
    url.search = "";
    url.hash = "";
    base = url.toString();
  } catch {
    throw new HttpError(400, "Укажите ссылку назначения (https://…)");
  }
  // параметри приходять готовим рядком з конструктора; перевіряємо формат і довжину
  const params = String(body.params || "").trim().replace(/^\?/, "");
  if (params.length > 2000 || /[\s<>"]/.test(params)) throw new HttpError(400, "Некорректные параметры ссылки");
  const platform = PLATFORMS.includes(body.platform) ? body.platform : "manual";
  let code = clean(body.code, 32).toLowerCase();
  if (code) {
    if (!CODE_RE.test(code)) throw new HttpError(400, "Короткий код: 3–32 символа, латиница, цифры и дефис");
    if (links.find((l) => l.code === code && !l.deleted)) throw new HttpError(409, "Такой код уже занят");
  } else code = randomCode();
  const title = clean(body.title, 80) || new URLSearchParams(params).get("utm_campaign") || base.replace(/^https?:\/\//, "");
  return publicLink(
    links.insert({ code, title, base, params, platform, clicks: 0, byDay: {}, refs: {}, createdAt: now(), createdBy: { userId: user.id, name: user.name } }),
  );
}

export function deleteLink(id) {
  const link = links.get(id);
  if (!link || link.deleted) throw new HttpError(404, "Ссылка не найдена");
  links.update(link.id, (l) => {
    l.deleted = true;
  });
}

const refHost = (ref) => {
  try {
    const host = new URL(ref).hostname.replace(/^(www|m|l|lm)\./, "");
    if (/facebook|fb\.com/.test(host)) return "facebook";
    if (/instagram/.test(host)) return "instagram";
    if (/t\.co$|twitter|x\.com/.test(host)) return "x.com";
    if (/t\.me|telegram/.test(host)) return "telegram";
    return host;
  } catch {
    return "";
  }
};

/** GET /go/<код> — публічний редирект */
export function handleShortLink(req, res) {
  const code = decodeURIComponent(req.url.split("?")[0].replace(/^\/go\//, "")).toLowerCase().replace(/\/$/, "");
  const link = CODE_RE.test(code) ? links.find((l) => l.code === code && !l.deleted) : null;
  if (!link) {
    res.writeHead(302, { Location: SITE_URL, "Cache-Control": "no-store" });
    return res.end();
  }
  const ua = String(req.headers["user-agent"] || "");
  const bot = /bot|crawl|spider|preview|facebookexternalhit|telegrambot|whatsapp|slack/i.test(ua);
  if (!bot) {
    const ref = refHost(String(req.headers.referer || "")) || "(direct)";
    const day = dayKey();
    links.update(link.id, (l) => {
      l.clicks = (l.clicks || 0) + 1;
      l.byDay = l.byDay || {};
      l.byDay[day] = (l.byDay[day] || 0) + 1;
      // лише останні 120 днів
      const keys = Object.keys(l.byDay).sort();
      while (keys.length > 120) delete l.byDay[keys.shift()];
      l.refs = l.refs || {};
      l.refs[ref] = (l.refs[ref] || 0) + 1;
      l.lastClickAt = now();
    });
  }
  const target = `${fullUrl(link)}${link.params ? "&" : "?"}pl=${link.code}`;
  res.writeHead(302, { Location: target, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer-when-downgrade" });
  res.end();
}

