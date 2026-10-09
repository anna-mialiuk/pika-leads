/**
 * Microsoft Clarity Data Export API — метрики поведінки за останні 1–3 доби.
 *
 * .env сервера: CLARITY_PROJECT_ID (з адреси проєкту в Clarity), CLARITY_API_TOKEN
 * (Settings → Data Export → Generate new API token).
 *
 * Ліміт Clarity — 10 запитів на проєкт на добу, тому:
 *   одна синхронізація = 3 запити (загальні метрики, розбивка за URL, за пристроями);
 *   автоматично — раз на 8 годин; вручну — не частіше разу на 2 години;
 *   результат зберігається у clarity.json і переживає перезапуск сервісу.
 * Теплові карти й записи сесій API не віддає — для них кнопки ведуть у кабінет Clarity.
 */
import { CLARITY_API_TOKEN, CLARITY_API_URL, CLARITY_PROJECT_ID } from "./config.mjs";
import { HttpError } from "./http.mjs";
import { readJson, writeJson } from "./store.mjs";

const FILE = "clarity.json";
const AUTO_EVERY = 8 * 60 * 60_000;
const MANUAL_EVERY = 2 * 60 * 60_000;
const DAILY_LIMIT = 9;

export const clarityReady = () => Boolean(CLARITY_PROJECT_ID && CLARITY_API_TOKEN);

const state = () => readJson(FILE, { data: null, syncedAt: null, error: "", calls: { day: "", count: 0 } });

const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

async function call(params) {
  const s = state();
  const today = new Date().toISOString().slice(0, 10);
  const calls = s.calls?.day === today ? s.calls : { day: today, count: 0 };
  if (calls.count >= DAILY_LIMIT) throw new HttpError(429, "Лимит запросов к Clarity на сегодня исчерпан — данные обновятся завтра");
  calls.count += 1;
  writeJson(FILE, { ...s, calls });

  const url = `${CLARITY_API_URL}/export-data/api/v1/project-live-insights?${new URLSearchParams(params)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${CLARITY_API_TOKEN}`, "Content-Type": "application/json" } });
  const body = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) throw new HttpError(502, "Clarity отклонил токен — сгенерируйте новый в Settings → Data Export");
  if (response.status === 429) throw new HttpError(429, "Лимит запросов к Clarity на сегодня исчерпан — данные обновятся завтра");
  if (!response.ok || !Array.isArray(body)) throw new HttpError(502, `Ошибка Clarity: HTTP ${response.status}`);
  return body;
}

/** Масив метрик Clarity → { Traffic: [...], RageClickCount: [...] } з нормалізованими назвами */
const byMetric = (list) =>
  Object.fromEntries(list.map((m) => [String(m.metricName || "").replace(/[\s/]/g, ""), Array.isArray(m.information) ? m.information : []]));

/** Частка сесій з проблемою: Clarity віддає sessionsWithMetricPercentage або кількість */
const issue = (rows) => {
  const row = rows?.[0] || {};
  return {
    pct: num(row.sessionsWithMetricPercentage ?? row.sessionsWithMetricPercent),
    count: num(row.subTotal ?? row.sessionsCount ?? row.count),
  };
};

function summarize(total, byUrl, byDevice) {
  const t = byMetric(total);
  const u = byMetric(byUrl);
  const d = byMetric(byDevice);
  const traffic = t.Traffic?.[0] || {};
  const engagement = t.EngagementTime?.[0] || {};
  const scroll = t.ScrollDepth?.[0] || {};

  // проблемні сторінки: rage/dead-кліки та швидкі повернення за URL
  const pages = new Map();
  const addPages = (rows, key) =>
    (rows || []).forEach((row) => {
      const url = row.URL || row.Url || row.url;
      if (!url) return;
      const page = pages.get(url) || { url, sessions: 0, rage: 0, dead: 0, quickback: 0, scroll: 0 };
      if (key === "sessions") page.sessions = num(row.totalSessionCount);
      else if (key === "scroll") page.scroll = num(row.averageScrollDepth);
      else page[key] = num(row.sessionsWithMetricPercentage ?? row.subTotal);
      pages.set(url, page);
    });
  addPages(u.Traffic, "sessions");
  addPages(u.RageClickCount, "rage");
  addPages(u.DeadClickCount, "dead");
  addPages(u.QuickbackClick, "quickback");
  addPages(u.ScrollDepth, "scroll");

  const popular = (t.PopularPages || []).map((p) => ({ url: p.url || p.URL || "", visits: num(p.visitsCount ?? p.sessionsCount) })).filter((p) => p.url);

  return {
    sessions: num(traffic.totalSessionCount),
    botSessions: num(traffic.totalBotSessionCount),
    users: num(traffic.distantUserCount ?? traffic.distinctUserCount),
    pagesPerSession: num(traffic.PagesPerSessionPercentage ?? traffic.pagesPerSessionPercentage),
    activeTime: num(engagement.activeTime),
    totalTime: num(engagement.totalTime),
    scrollDepth: num(scroll.averageScrollDepth),
    rage: issue(t.RageClickCount),
    dead: issue(t.DeadClickCount),
    quickback: issue(t.QuickbackClick),
    excessiveScroll: issue(t.ExcessiveScroll),
    scriptErrors: issue(t.ScriptErrorCount),
    errorClicks: issue(t.ErrorClickCount),
    popular: popular.slice(0, 10),
    pages: [...pages.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 15),
    devices: (d.Traffic || []).map((row) => ({ device: row.Device || row.device || "Other", sessions: num(row.totalSessionCount) })).sort((a, b) => b.sessions - a.sessions),
    referrers: (t.ReferrerUrl || []).map((r) => ({ name: r.name || r.ReferrerUrl || r.url || "", sessions: num(r.sessionsCount ?? r.totalSessionCount) })).filter((r) => r.name).slice(0, 8),
  };
}

let syncing = null;

export async function claritySync({ manual = false } = {}) {
  if (!clarityReady()) throw new HttpError(400, "Clarity не подключён");
  const s = state();
  const age = s.syncedAt ? Date.now() - new Date(s.syncedAt).getTime() : Infinity;
  if (manual && age < MANUAL_EVERY) {
    throw new HttpError(429, "Clarity даёт 10 запросов в сутки — обновлять вручную можно раз в 2 часа");
  }
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const total = await call({ numOfDays: "3" });
      const byUrl = await call({ numOfDays: "3", dimension1: "URL" });
      const byDevice = await call({ numOfDays: "3", dimension1: "Device" });
      const data = summarize(total, byUrl, byDevice);
      writeJson(FILE, { ...state(), data, syncedAt: new Date().toISOString(), error: "" });
    } catch (error) {
      writeJson(FILE, { ...state(), error: error.message });
      throw error;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

export function clarityData() {
  const s = state();
  return {
    configured: clarityReady(),
    projectId: CLARITY_PROJECT_ID,
    dashboardUrl: CLARITY_PROJECT_ID ? `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/dashboard` : "",
    heatmapsUrl: CLARITY_PROJECT_ID ? `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/heatmaps` : "",
    recordingsUrl: CLARITY_PROJECT_ID ? `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/impressions` : "",
    syncedAt: s.syncedAt,
    error: s.error || "",
    callsToday: s.calls?.day === new Date().toISOString().slice(0, 10) ? s.calls.count : 0,
    data: s.data,
  };
}

/** Автосинхронізація раз на 8 годин */
export function startClaritySync() {
  const tick = () => {
    if (!clarityReady()) return;
    const s = state();
    const age = s.syncedAt ? Date.now() - new Date(s.syncedAt).getTime() : Infinity;
    if (age >= AUTO_EVERY) claritySync().catch((error) => console.error("[clarity]", error.message));
  };
  setTimeout(tick, 20_000).unref();
  setInterval(tick, 30 * 60_000).unref();
}
