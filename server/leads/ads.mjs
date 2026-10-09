/**
 * Рекламні кабінети для «Аналитика → Рекламные кабинеты» й «Обзор».
 *
 *   Meta Ads — автоматично через Marketing API (токен META_ADS_TOKEN з правом ads_read):
 *              статус, баланс, кампанії по днях, оголошення з мініатюрами — синхронізація щогодини.
 *   Google Ads, TikTok — дані вносяться вручну (день · кампанія · витрата · кліки · конверсії).
 *
 * Помічник байєра працює на цих даних: сигнали (оплата, модерація, дорогий лід, бюджет, CTR),
 * автоправила (рекомендації, без зміни кабінетів — доступ лише на читання), Telegram-алерти.
 */
import crypto from "node:crypto";

import { META_ADS_TOKEN, META_API_URL, META_API_VERSION, TIMEZONE } from "./config.mjs";
import { users } from "./auth.mjs";
import { HttpError } from "./http.mjs";
import { projectExists } from "./projects.mjs";
import { createCollection, readJson, writeJson } from "./store.mjs";
import { clean, escapeHtml, telegram, telegramEnabled } from "./telegram.mjs";
import { CHAT_IDS } from "./config.mjs";

export const cabinets = createCollection("ad-accounts.json");
export const adStats = createCollection("ad-stats.json");
export const adRules = createCollection("ad-rules.json");

export const PLATFORMS = ["meta", "google", "tiktok"];
export const CAB_STATUSES = ["active", "review", "payment", "disabled", "paused"];
const PLATFORM_LABELS = { meta: "Meta Ads", google: "Google Ads", tiktok: "TikTok Ads" };
const STATUS_LABELS = { active: "Активен", review: "На модерации", payment: "Нужна оплата", disabled: "Отключён", paused: "Пауза" };

export const metaAdsReady = () => Boolean(META_ADS_TOKEN);

const now = () => new Date().toISOString();
const DAY = 86_400_000;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;

/** Дата YYYY-MM-DD у часовому поясі агенції */
export const dayKey = (time = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));

// ---------- налаштування аналітики (settings.json → analytics) ----------
const DEFAULT_SETTINGS = {
  autopilot: true,
  goals: { newUsers: 20000, views: 250000, sessions: 85000, bounce: 30 },
  tg: { enabled: false, chatId: "", events: { payment: true, ban: true, rejection: true, cpa: true, budget: true, ctr: false } },
  cpaMultiplier: 1.5, // «дорогий лід» — CPA вище медіани в N разів
  ctrMin: 1, // %
};

export function analyticsSettings() {
  const stored = readJson("settings.json", {}).analytics || {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    goals: { ...DEFAULT_SETTINGS.goals, ...(stored.goals || {}) },
    tg: { ...DEFAULT_SETTINGS.tg, ...(stored.tg || {}), events: { ...DEFAULT_SETTINGS.tg.events, ...(stored.tg?.events || {}) } },
  };
}

export function saveAnalyticsSettings(body) {
  const cur = analyticsSettings();
  const next = { ...cur };
  if ("autopilot" in body) next.autopilot = Boolean(body.autopilot);
  if (body.goals && typeof body.goals === "object") {
    next.goals = { ...cur.goals };
    for (const key of Object.keys(DEFAULT_SETTINGS.goals)) {
      if (key in body.goals) {
        const value = Number(body.goals[key]);
        if (!Number.isFinite(value) || value < 0 || value > 1e10) throw new HttpError(400, "Некорректная цель");
        next.goals[key] = value;
      }
    }
  }
  if (body.tg && typeof body.tg === "object") {
    next.tg = { ...cur.tg, events: { ...cur.tg.events } };
    if ("enabled" in body.tg) next.tg.enabled = Boolean(body.tg.enabled);
    if ("chatId" in body.tg) {
      const chat = clean(body.tg.chatId, 64);
      if (chat && !/^(@[A-Za-z0-9_]{4,}|-?\d{5,})$/.test(chat)) throw new HttpError(400, "Укажите @канал или числовой chat id");
      next.tg.chatId = chat;
    }
    if (body.tg.events && typeof body.tg.events === "object") {
      for (const key of Object.keys(DEFAULT_SETTINGS.tg.events)) if (key in body.tg.events) next.tg.events[key] = Boolean(body.tg.events[key]);
    }
  }
  const all = readJson("settings.json", {});
  writeJson("settings.json", { ...all, analytics: next });
  return next;
}

// ---------- кабінети ----------
export function publicCabinet(c) {
  return {
    id: c.id,
    platform: c.platform,
    name: c.name,
    accountId: c.accountId,
    currency: c.currency,
    status: c.status,
    budget: c.budget,
    niche: c.niche,
    buyerId: c.buyerId,
    projectId: c.projectId,
    source: c.source,
    createdAt: c.createdAt,
    createdBy: c.createdBy,
    meta: c.meta
      ? {
          syncedAt: c.meta.syncedAt,
          error: c.meta.error,
          balance: c.meta.balance,
          spendCap: c.meta.spendCap,
          amountSpent: c.meta.amountSpent,
          campaigns: c.meta.campaigns || [],
          ads: c.meta.ads || [],
        }
      : null,
    appeal: c.appeal || null,
    toppedUpAt: c.toppedUpAt || null,
    share: c.share ? { token: c.share.token, createdAt: c.share.createdAt } : null,
  };
}

function cleanCabinet(body, current = {}) {
  const out = {};
  if ("platform" in body || !current.platform) {
    if (!PLATFORMS.includes(body.platform)) throw new HttpError(400, "Укажите рекламную платформу");
    out.platform = body.platform;
  }
  if ("name" in body || !current.name) {
    out.name = clean(body.name, 80);
    if (!out.name) throw new HttpError(400, "Укажите название кабинета");
  }
  if ("accountId" in body) {
    let acc = clean(body.accountId, 40).replace(/\s/g, "");
    const platform = out.platform || current.platform;
    if (platform === "meta" && acc && !/^act_/.test(acc)) acc = `act_${acc}`;
    if (acc && !/^[A-Za-z0-9_-]+$/.test(acc)) throw new HttpError(400, "ID кабинета: только латиница, цифры, «_» и «-»");
    out.accountId = acc;
  }
  if ("currency" in body) {
    const cur = clean(body.currency, 3).toUpperCase();
    if (cur && !/^[A-Z]{3}$/.test(cur)) throw new HttpError(400, "Валюта — три буквы, например USD");
    out.currency = cur || "USD";
  }
  if ("status" in body) {
    if (!CAB_STATUSES.includes(body.status)) throw new HttpError(400, "Неизвестный статус кабинета");
    out.status = body.status;
  }
  if ("budget" in body) {
    const b = body.budget === "" || body.budget === null ? 0 : Number(body.budget);
    if (!Number.isFinite(b) || b < 0 || b > 1e8) throw new HttpError(400, "Некорректный бюджет");
    out.budget = round2(b);
  }
  if ("niche" in body) out.niche = clean(body.niche, 40);
  if ("buyerId" in body) {
    const id = body.buyerId ? Number(body.buyerId) : null;
    if (id && !users.get(id)) throw new HttpError(400, "Сотрудник не найден");
    out.buyerId = id;
  }
  if ("projectId" in body) {
    const id = body.projectId ? Number(body.projectId) : null;
    if (id && !projectExists(id)) throw new HttpError(400, "Проект не найден");
    out.projectId = id;
  }
  return out;
}

export function createCabinet(body, user) {
  const data = cleanCabinet(body);
  if (data.platform === "meta" && data.accountId && cabinets.find((c) => !c.deleted && c.accountId === data.accountId)) {
    throw new HttpError(409, "Этот кабинет уже подключён");
  }
  const cab = cabinets.insert({
    currency: "USD",
    status: "active",
    budget: 0,
    niche: "",
    buyerId: null,
    projectId: null,
    accountId: "",
    ...data,
    source: data.platform === "meta" && data.accountId && metaAdsReady() ? "api" : "manual",
    createdAt: now(),
    createdBy: { userId: user.id, name: user.name },
  });
  if (cab.source === "api") syncMetaCabinet(cab.id).catch((error) => console.error("[ads] meta:", error.message));
  return cab;
}

export function updateCabinet(id, body) {
  const cab = cabinetOr404(id);
  const data = cleanCabinet(body, cab);
  delete data.platform;
  return cabinets.update(cab.id, (c) => {
    Object.assign(c, data);
    // бюджет, заданий вручну, синхронізація Meta не перезаписує
    if ("budget" in data) c.budgetManual = data.budget > 0;
    c.updatedAt = now();
  });
}

export function deleteCabinet(id) {
  const cab = cabinetOr404(id);
  cabinets.update(cab.id, (c) => {
    c.deleted = true;
    c.share = null;
  });
}

export function cabinetOr404(id) {
  const cab = cabinets.get(id);
  if (!cab || cab.deleted) throw new HttpError(404, "Кабинет не найден");
  return cab;
}

export const activeCabinets = () => cabinets.filter((c) => !c.deleted);

// ---------- ручні дані ----------
export function addStat(cabinetId, body, user) {
  const cab = cabinetOr404(cabinetId);
  if (cab.source === "api") throw new HttpError(400, "Данные этого кабинета приходят из Meta автоматически");
  const date = String(body.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new HttpError(400, "Укажите дату");
  const row = { cabinetId: cab.id, date, campaign: clean(body.campaign, 120) };
  for (const key of ["spend", "impressions", "clicks", "conversions", "reach"]) {
    const value = body[key] === "" || body[key] == null ? 0 : Number(body[key]);
    if (!Number.isFinite(value) || value < 0 || value > 1e10) throw new HttpError(400, "Некорректные цифры");
    row[key] = key === "spend" ? round2(value) : Math.round(value);
  }
  if (!row.spend && !row.clicks && !row.impressions && !row.conversions) throw new HttpError(400, "Заполните хотя бы одну цифру");
  // той самий день + кампанія — перезаписуємо
  const existing = adStats.find((s) => s.cabinetId === cab.id && s.date === row.date && s.campaign === row.campaign && s.source === "manual");
  if (existing) return adStats.update(existing.id, (s) => Object.assign(s, row, { updatedAt: now() }));
  return adStats.insert({ ...row, source: "manual", createdAt: now(), by: { userId: user.id, name: user.name } });
}

export function deleteStat(cabinetId, statId) {
  const stat = adStats.get(statId);
  if (!stat || stat.cabinetId !== Number(cabinetId) || stat.deleted) throw new HttpError(404, "Запись не найдена");
  adStats.update(stat.id, (s) => {
    s.deleted = true;
  });
}

export const manualStats = (cabinetId) =>
  adStats
    .filter((s) => s.cabinetId === Number(cabinetId) && !s.deleted && s.source === "manual")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 200);

// ---------- зведення ----------
/** Рядки статистики кабінету в межах [from, to] (дати YYYY-MM-DD включно) */
const statsIn = (cabId, from, to) => adStats.filter((s) => s.cabinetId === cabId && !s.deleted && s.date >= from && s.date <= to);

function totals(rows) {
  const t = rows.reduce(
    (acc, r) => {
      acc.spend += num(r.spend);
      acc.impressions += num(r.impressions);
      acc.clicks += num(r.clicks);
      acc.conv += num(r.conversions);
      acc.reach += num(r.reach);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conv: 0, reach: 0 },
  );
  t.spend = round2(t.spend);
  t.ctr = t.impressions ? round2((t.clicks / t.impressions) * 100) : 0;
  t.cpa = t.conv ? round2(t.spend / t.conv) : 0;
  t.cpm = t.impressions ? round2((t.spend / t.impressions) * 1000) : 0;
  return t;
}

const rangeOf = (days, offset = 0) => {
  const to = Date.now() - offset * days * DAY;
  return { from: dayKey(to - (days - 1) * DAY), to: dayKey(to) };
};

/** custom — { from, to } (YYYY-MM-DD) замість «останніх days днів» */
export function cabinetSummary(cab, days, custom = null) {
  let cur = rangeOf(days);
  let prev = rangeOf(days, 1);
  if (custom) {
    const span = Math.round((Date.parse(custom.to) - Date.parse(custom.from)) / DAY) + 1;
    days = Math.max(1, Math.min(400, span));
    cur = { from: custom.from, to: custom.to };
    prev = { from: dayKey(Date.parse(custom.from) - days * DAY), to: dayKey(Date.parse(custom.from) - DAY) };
  }
  const rows = statsIn(cab.id, cur.from, cur.to);
  const today = totals(statsIn(cab.id, dayKey(), dayKey()));
  const yesterday = totals(statsIn(cab.id, dayKey(Date.now() - DAY), dayKey(Date.now() - DAY)));
  // кампанії: агрегуємо за назвою; бюджет/статус — з Meta
  const metaCamps = new Map((cab.meta?.campaigns || []).map((c) => [c.name, c]));
  const byCamp = new Map();
  for (const r of rows) {
    const name = r.campaign || "—";
    if (!byCamp.has(name)) byCamp.set(name, []);
    byCamp.get(name).push(r);
  }
  const campaigns = [...byCamp.entries()]
    .map(([name, list]) => {
      const t = totals(list);
      const m = metaCamps.get(name);
      return { name, ...t, budget: m?.budget ?? null, status: m?.status ?? null };
    })
    .sort((a, b) => b.spend - a.spend);
  // кампанії з Meta без витрат за період теж показуємо
  for (const m of cab.meta?.campaigns || []) {
    if (!byCamp.has(m.name)) campaigns.push({ name: m.name, spend: 0, impressions: 0, clicks: 0, conv: 0, reach: 0, ctr: 0, cpa: 0, cpm: 0, budget: m.budget, status: m.status });
  }
  // по днях — для трендів
  const daily = [];
  const end = custom ? Date.parse(`${cur.to}T12:00:00Z`) : Date.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = dayKey(end - i * DAY);
    const t = totals(rows.filter((r) => r.date === d));
    daily.push({ date: d, spend: t.spend, conv: t.conv, clicks: t.clicks });
  }
  return { ...totals(rows), prev: totals(statsIn(cab.id, prev.from, prev.to)), today, yesterday, campaigns, daily, range: cur };
}

// ---------- Meta Marketing API ----------
const META_STATUS = { 1: "active", 2: "disabled", 3: "payment", 7: "review", 8: "payment", 9: "payment", 100: "disabled", 101: "disabled", 201: "active", 202: "disabled" };
const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "onsite_web_lead", "offsite_conversion.fb_pixel_complete_registration"];

/** Конверсії з actions: беремо перший знайдений тип (щоб не рахувати двічі один лід) */
const resultsOf = (actions = []) => {
  for (const type of LEAD_ACTIONS) {
    const hit = actions.find((a) => a.action_type === type);
    if (hit) return num(hit.value);
  }
  return 0;
};

async function metaGet(path, params = {}) {
  const url = new URL(`${META_API_URL}/${META_API_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  url.searchParams.set("access_token", META_ADS_TOKEN);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error?.message || `Meta HTTP ${response.status}`);
  return body;
}

/** Усі сторінки відповіді (paging.next) */
async function metaAll(path, params, max = 20) {
  const out = [];
  let body = await metaGet(path, params);
  out.push(...(body.data || []));
  let pages = 1;
  while (body.paging?.next && pages < max) {
    const response = await fetch(body.paging.next, { signal: AbortSignal.timeout(30_000) });
    body = await response.json().catch(() => ({}));
    if (body.error) throw new Error(body.error.message);
    out.push(...(body.data || []));
    pages += 1;
  }
  return out;
}

/** Кабінети, доступні токену, — для вибору при підключенні */
export async function metaAccountsList() {
  if (!metaAdsReady()) throw new HttpError(400, "Meta Ads API не подключён: добавьте META_ADS_TOKEN в .env сервера");
  try {
    const list = await metaAll("me/adaccounts", { fields: "name,account_id,currency,account_status", limit: "100" }, 5);
    const taken = new Set(activeCabinets().map((c) => c.accountId));
    return list.map((a) => ({ accountId: `act_${a.account_id}`, name: a.name, currency: a.currency, status: META_STATUS[a.account_status] || "active", connected: taken.has(`act_${a.account_id}`) }));
  } catch (error) {
    throw new HttpError(502, `Meta: ${error.message}`);
  }
}

export async function syncMetaCabinet(id) {
  const cab = cabinets.get(id);
  if (!cab || cab.deleted || cab.platform !== "meta" || !cab.accountId || !metaAdsReady()) return;
  const acc = cab.accountId;
  try {
    const info = await metaGet(acc, { fields: "name,account_status,currency,amount_spent,spend_cap,balance,disable_reason" });
    const since = dayKey(Date.now() - 89 * DAY);
    const until = dayKey();
    const [insights, campaigns, adInsights, ads] = await Promise.all([
      metaAll(`${acc}/insights`, {
        level: "campaign",
        time_increment: "1",
        time_range: { since, until },
        fields: "campaign_name,campaign_id,spend,impressions,clicks,reach,actions",
        limit: "500",
      }),
      metaAll(`${acc}/campaigns`, { fields: "name,status,effective_status,daily_budget,lifetime_budget", limit: "200" }, 5),
      metaAll(`${acc}/insights`, { level: "ad", date_preset: "last_30d", fields: "ad_id,ad_name,spend,impressions,reach,clicks,actions", limit: "100", sort: "spend_descending" }, 2),
      metaAll(`${acc}/ads`, { fields: "name,creative{thumbnail_url,object_type}", limit: "200" }, 3).catch(() => []),
    ]);
    const thumbs = new Map(ads.map((a) => [a.id, a.creative || {}]));
    const minor = (v) => round2(num(v) / 100); // гроші акаунта в Meta — у центах

    // замінюємо синхронізовані рядки за 90 днів
    const fresh = insights.map((r) => ({
      cabinetId: cab.id,
      date: r.date_start,
      campaign: r.campaign_name || "",
      spend: round2(num(r.spend)),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      reach: num(r.reach),
      conversions: resultsOf(r.actions),
      source: "meta",
    }));
    for (const old of adStats.filter((s) => s.cabinetId === cab.id && s.source === "meta" && s.date >= since && !s.deleted)) {
      adStats.update(old.id, (s) => {
        s.deleted = true;
      });
    }
    if (fresh.length) adStats.insertMany(fresh);
    // прибираємо «видалені» синхронізовані рядки, щоб файл не ріс
    compactStats();

    cabinets.update(cab.id, (c) => {
      c.status = META_STATUS[info.account_status] || c.status;
      c.currency = info.currency || c.currency;
      c.meta = {
        syncedAt: now(),
        error: "",
        statusRaw: info.account_status,
        disableReason: info.disable_reason ?? null,
        balance: minor(info.balance),
        spendCap: minor(info.spend_cap),
        amountSpent: minor(info.amount_spent),
        campaigns: campaigns.map((x) => ({
          id: x.id,
          name: x.name,
          status: String(x.effective_status || x.status || "").toLowerCase(),
          budget: x.daily_budget ? minor(x.daily_budget) : x.lifetime_budget ? minor(x.lifetime_budget) : null,
        })),
        ads: adInsights.slice(0, 30).map((a) => ({
          id: a.ad_id,
          name: a.ad_name,
          thumb: thumbs.get(a.ad_id)?.thumbnail_url || "",
          format: String(thumbs.get(a.ad_id)?.object_type || "").toLowerCase(),
          spend: round2(num(a.spend)),
          impressions: num(a.impressions),
          reach: num(a.reach),
          clicks: num(a.clicks),
          results: resultsOf(a.actions),
        })),
      };
      // денний бюджет кабінету = сума денних бюджетів активних кампаній (якщо не задано вручну)
      if (!c.budgetManual) {
        const daily = campaigns.filter((x) => String(x.effective_status || "").toUpperCase() === "ACTIVE" && x.daily_budget).reduce((s, x) => s + minor(x.daily_budget), 0);
        if (daily) c.budget = round2(daily);
      }
    });
  } catch (error) {
    cabinets.update(cab.id, (c) => {
      c.meta = { ...(c.meta || {}), error: error.message, syncedAt: c.meta?.syncedAt || null };
    });
    throw error;
  }
}

function compactStats() {
  const dead = adStats.filter((s) => s.deleted && s.source === "meta").length;
  if (dead < 2000) return;
  const state = readJson("ad-stats.json", { nextId: 1, items: [] });
  state.items = state.items.filter((s) => !(s.deleted && s.source === "meta"));
  writeJson("ad-stats.json", state);
}

export async function syncAllMeta() {
  for (const cab of activeCabinets().filter((c) => c.platform === "meta" && c.accountId)) {
    try {
      await syncMetaCabinet(cab.id);
    } catch (error) {
      console.error(`[ads] meta ${cab.accountId}:`, error.message);
    }
  }
}

// ---------- автоправила ----------
export const RULE_METRICS = ["CPA", "ROAS", "CTR", "Frequency", "Расход дня", "Конверсии", "CPM"];
export const RULE_OPS = [">", "<", "≥", "≤", "="];
export const RULE_UNITS = ["$", "%", "бюджет", ""];
export const RULE_ACTIONS = ["notify", "pause", "budget_up", "budget_down", "duplicate", "creative"];
export const RULE_TAGS = ["рост", "защита", "бюджет", "качество"];

const DEFAULT_RULES = [
  { name: "Стоп дорогих лидов", metric: "CPA", op: ">", val: 18, unit: "$", window: "за 24 часа", actionType: "pause", amount: 0, tag: "защита" },
  { name: "Скейл победителей", metric: "CPA", op: "<", val: 9, unit: "$", window: "за 24 часа", actionType: "budget_up", amount: 20, tag: "рост" },
  { name: "Контроль бюджета", metric: "Расход дня", op: "≥", val: "", unit: "бюджет", window: "", actionType: "notify", amount: 0, tag: "бюджет" },
];

export function listRules() {
  if (!adRules.existed && adRules.size === 0 && !readJson("settings.json", {}).analytics?.rulesSeeded) {
    adRules.insertMany(DEFAULT_RULES.map((r) => ({ ...r, on: true, isAi: false, createdAt: now() })));
    const all = readJson("settings.json", {});
    writeJson("settings.json", { ...all, analytics: { ...(all.analytics || {}), rulesSeeded: true } });
  }
  return adRules.filter((r) => !r.deleted);
}

export function cleanRule(body) {
  const name = clean(body.name, 80);
  if (!name) throw new HttpError(400, "Укажите название правила");
  if (!RULE_METRICS.includes(body.metric)) throw new HttpError(400, "Неизвестная метрика");
  if (!RULE_OPS.includes(body.op)) throw new HttpError(400, "Неизвестный оператор");
  if (!RULE_UNITS.includes(body.unit ?? "")) throw new HttpError(400, "Неизвестная единица");
  if (!RULE_ACTIONS.includes(body.actionType)) throw new HttpError(400, "Неизвестное действие");
  if (!RULE_TAGS.includes(body.tag)) throw new HttpError(400, "Неизвестная категория");
  let val = "";
  if (body.unit !== "бюджет") {
    val = Number(body.val);
    if (body.val === "" || !Number.isFinite(val)) throw new HttpError(400, "Укажите значение условия");
  }
  const amount = body.amount === "" || body.amount == null ? 0 : Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 500) throw new HttpError(400, "Процент — от 0 до 500");
  return { name, metric: body.metric, op: body.op, val, unit: body.unit ?? "", window: clean(body.window, 60), actionType: body.actionType, amount, tag: body.tag };
}

export const createRule = (body, user, isAi = false) => adRules.insert({ ...cleanRule(body), on: true, isAi, createdAt: now(), by: { userId: user.id, name: user.name } });

export function updateRule(id, body) {
  const rule = adRules.get(id);
  if (!rule || rule.deleted) throw new HttpError(404, "Правило не найдено");
  if (Object.keys(body).length === 1 && "on" in body) return adRules.update(rule.id, (r) => (r.on = Boolean(body.on)));
  const data = cleanRule({ ...rule, ...body });
  return adRules.update(rule.id, (r) => Object.assign(r, data, { updatedAt: now() }));
}

export function deleteRule(id) {
  const rule = adRules.get(id);
  if (!rule || rule.deleted) throw new HttpError(404, "Правило не найдено");
  adRules.update(rule.id, (r) => (r.deleted = true));
}

const compare = (a, op, b) => ({ ">": a > b, "<": a < b, "≥": a >= b, "≤": a <= b, "=": Math.abs(a - b) < 1e-9 })[op];

/** Значення метрики правила для кабінету: за останню добу (вчора + сьогодні — щоб не залежати від години) */
function ruleValue(rule, cab, s, revenueOf) {
  const d = totals([...statsIn(cab.id, dayKey(Date.now() - DAY), dayKey())]);
  switch (rule.metric) {
    case "CPA":
      return d.conv ? d.spend / d.conv : null;
    case "CTR":
      return d.impressions ? (d.clicks / d.impressions) * 100 : null;
    case "CPM":
      return d.impressions ? (d.spend / d.impressions) * 1000 : null;
    case "Frequency":
      return d.reach ? d.impressions / d.reach : null;
    case "Конверсии":
      return d.conv;
    case "Расход дня":
      return s.today.spend;
    case "ROAS": {
      const rev = revenueOf(cab);
      return s.spend ? rev / s.spend : null;
    }
    default:
      return null;
  }
}

export function evaluateRules(cab, summary, revenueOf) {
  if (cab.status !== "active") return [];
  const hits = [];
  for (const rule of listRules().filter((r) => r.on)) {
    const value = ruleValue(rule, cab, summary, revenueOf);
    if (value === null || value === undefined) continue;
    const target = rule.unit === "бюджет" ? num(cab.budget) : num(rule.val);
    if (rule.unit === "бюджет" && !target) continue;
    if (compare(value, rule.op, target)) hits.push({ ruleId: rule.id, rule: rule.name, metric: rule.metric, value: round2(value), target, actionType: rule.actionType, amount: rule.amount, tag: rule.tag });
  }
  return hits;
}

// ---------- сигнали (моніторинг) ----------
export function signalsFor(list, settings, revenueOf) {
  const active = list.filter((x) => x.cab.status === "active" && x.s.cpa > 0);
  const cpas = active.map((x) => x.s.cpa).sort((a, b) => a - b);
  const median = cpas.length ? cpas[Math.floor(cpas.length / 2)] : 0;
  const alerts = [];
  for (const { cab, s } of list) {
    const base = { cabinetId: cab.id, acc: cab.name, platform: cab.platform, currency: cab.currency };
    if (cab.status === "payment") alerts.push({ ...base, key: "payment", sev: "high", kind: "payment" });
    else if (cab.status === "disabled") alerts.push({ ...base, key: "ban", sev: "high", kind: "ban" });
    else if (cab.status === "review") alerts.push({ ...base, key: "review", sev: "mid", kind: "review" });
    if (cab.status !== "active") continue;
    if (median && s.cpa > median * settings.cpaMultiplier && s.conv >= 3) alerts.push({ ...base, key: "cpa", sev: "mid", kind: "cpa", cpa: s.cpa, median: round2(median), cpaTrend: s.prev.cpa ? round2(((s.cpa - s.prev.cpa) / s.prev.cpa) * 100) : null });
    if (cab.budget && s.today.spend >= cab.budget * 0.9) alerts.push({ ...base, key: "budget", sev: "low", kind: "budget", used: round2((s.today.spend / cab.budget) * 100) });
    if (s.impressions >= 1000 && s.ctr < settings.ctrMin) alerts.push({ ...base, key: "ctr", sev: "low", kind: "ctr", ctr: s.ctr, ctrTrend: s.prev.ctr ? round2(((s.ctr - s.prev.ctr) / s.prev.ctr) * 100) : null });
    for (const hit of evaluateRules(cab, s, revenueOf)) alerts.push({ ...base, key: `rule:${hit.ruleId}`, sev: hit.tag === "защита" ? "mid" : "low", kind: "rule", ...hit });
  }
  const prio = { high: 3, mid: 2, low: 1 };
  return { alerts: alerts.sort((a, b) => prio[b.sev] - prio[a.sev]), medianCpa: round2(median) };
}

// ---------- Telegram-алерти ----------
const ALERT_TEXT = {
  payment: (a) => `💳 <b>Нужна оплата</b> · ${escapeHtml(a.acc)}\nПоказы остановлены — пополните баланс.`,
  ban: (a) => `⛔ <b>Кабинет отключён</b> · ${escapeHtml(a.acc)}\nПроверьте причину и подготовьте апелляцию.`,
  review: (a) => `🛡 <b>Кабинет на модерации</b> · ${escapeHtml(a.acc)}\nНе меняйте бюджет и креативы до конца проверки.`,
  cpa: (a) => `🎯 <b>Дорогой лид</b> · ${escapeHtml(a.acc)}\nCPA ${a.cpa} ${a.currency} при медиане ${a.median}.`,
  budget: (a) => `💰 <b>Бюджет почти исчерпан</b> · ${escapeHtml(a.acc)}\nОсвоено ${Math.round(a.used)}% дневного бюджета.`,
  ctr: (a) => `📉 <b>Просадка CTR</b> · ${escapeHtml(a.acc)}\nCTR ${a.ctr}% — обновите креатив.`,
  rule: (a) => `⚙️ <b>Правило «${escapeHtml(a.rule)}»</b> · ${escapeHtml(a.acc)}\n${escapeHtml(a.metric)} = ${a.value} — рекомендация: ${escapeHtml(ACTION_TEXT[a.actionType] || a.actionType)}${a.amount ? ` ${a.amount}%` : ""}.`,
};
const ACTION_TEXT = { notify: "уведомить", pause: "остановить", budget_up: "поднять бюджет на", budget_down: "снизить бюджет на", duplicate: "дублировать связку", creative: "заменить креатив" };
const EVENT_OF = { payment: "payment", ban: "ban", review: "rejection", cpa: "cpa", budget: "budget", ctr: "ctr", rule: "cpa" };

/** Кому слати: окремий чат із налаштувань або адміни/PM з підключеним Telegram */
function alertChats(settings) {
  if (settings.tg.chatId) return [settings.tg.chatId];
  const team = users.filter((u) => !u.disabled && (u.role === "admin" || u.role === "pm") && u.telegramChatId).map((u) => u.telegramChatId);
  return team.length ? team : CHAT_IDS;
}

export async function sendAlerts(alerts, settings) {
  if (!settings.tg.enabled || !telegramEnabled()) return 0;
  const sent = readJson("ad-alerts-sent.json", {});
  const today = dayKey();
  let count = 0;
  for (const alert of alerts) {
    const event = EVENT_OF[alert.kind];
    if (!settings.tg.events[event]) continue;
    if (alert.kind === "rule" && !settings.autopilot) continue;
    const key = `${alert.cabinetId}:${alert.key}`;
    if (sent[key] === today) continue; // один алерт на подію на добу
    const text = ALERT_TEXT[alert.kind]?.(alert);
    if (!text) continue;
    for (const chat of alertChats(settings)) {
      try {
        await telegram("sendMessage", { chat_id: chat, text: `${text}\n<i>AI-помощник Pika Leads</i>`, parse_mode: "HTML", disable_web_page_preview: true });
        count += 1;
      } catch (error) {
        console.error("[ads] telegram:", error.message);
      }
    }
    sent[key] = today;
  }
  // старі записи не тримаємо
  for (const [k, v] of Object.entries(sent)) if (v < dayKey(Date.now() - 7 * DAY)) delete sent[k];
  writeJson("ad-alerts-sent.json", sent);
  return count;
}

export async function sendTestAlert(settings) {
  if (!telegramEnabled()) throw new HttpError(400, "Telegram-бот не настроен на сервере");
  const chats = alertChats(settings);
  if (!chats.length) throw new HttpError(400, "Некому отправлять: укажите чат или подключите Telegram в профиле");
  for (const chat of chats) {
    try {
      await telegram("sendMessage", { chat_id: chat, text: "✅ <b>Тестовый алерт</b>\nAI-помощник байера подключён — сюда будут приходить сигналы по кабинетам.", parse_mode: "HTML" });
    } catch (error) {
      throw new HttpError(502, `Telegram не принял сообщение (${chat}): ${error.message}`);
    }
  }
  return chats.length;
}

// ---------- апеляції, оплата, посилання для клієнта ----------
export function setAppeal(id, patch) {
  const cab = cabinetOr404(id);
  return cabinets.update(cab.id, (c) => {
    c.appeal = { ...(c.appeal || {}), ...patch };
  });
}

export function markToppedUp(id) {
  const cab = cabinetOr404(id);
  return cabinets.update(cab.id, (c) => {
    c.toppedUpAt = now();
    if (c.status === "payment" && c.source !== "api") c.status = "active";
  });
}

export function billingUrl(cab) {
  if (cab.platform === "meta") return `https://business.facebook.com/billing_hub/accounts/details?asset_id=${encodeURIComponent(String(cab.accountId || "").replace(/^act_/, ""))}`;
  if (cab.platform === "google") return "https://ads.google.com/aw/billing/summary";
  return "https://ads.tiktok.com/i18n/account/payment";
}

export function shareCabinet(id, enable = true) {
  const cab = cabinetOr404(id);
  return cabinets.update(cab.id, (c) => {
    c.share = enable ? { token: crypto.randomBytes(18).toString("base64url"), createdAt: now() } : null;
  });
}

export function sharedCabinet(token) {
  if (!token || token.length < 20) return null;
  return activeCabinets().find((c) => c.share?.token === token) || null;
}

export const platformLabel = (p) => PLATFORM_LABELS[p] || p;
export const statusLabel = (s) => STATUS_LABELS[s] || s;

// ---------- фонова робота ----------
export function startAds(collectSignals) {
  const tick = async () => {
    if (metaAdsReady()) await syncAllMeta();
    try {
      const { alerts } = collectSignals();
      await sendAlerts(alerts, analyticsSettings());
    } catch (error) {
      console.error("[ads] alerts:", error.message);
    }
  };
  setTimeout(() => tick().catch(() => {}), 30_000).unref();
  setInterval(() => tick().catch(() => {}), 60 * 60_000).unref();
}
