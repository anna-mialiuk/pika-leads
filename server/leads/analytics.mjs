/**
 * Маршрути розділу «Аналитика»: огляд, рекламні кабінети + AI-помічник, UTM-посилання, GA4, Clarity.
 * Зведення по заявках (CRM) рахує браузер з /leads; тут — те, що потребує сервера:
 * зовнішні API, кабінети, правила, AI і зв'язок «заявка → кабінет» за utm_campaign.
 */
import { aiJson, aiReady, aiText } from "./ai.mjs";
import { SHORT_LINK_BASE } from "./config.mjs";
import {
  RULE_ACTIONS,
  RULE_METRICS,
  RULE_OPS,
  RULE_TAGS,
  RULE_UNITS,
  activeCabinets,
  addStat,
  analyticsSettings,
  billingUrl,
  cabinetOr404,
  cabinetSummary,
  createCabinet,
  createRule,
  deleteCabinet,
  deleteRule,
  deleteStat,
  listRules,
  manualStats,
  markToppedUp,
  metaAccountsList,
  metaAdsReady,
  platformLabel,
  publicCabinet,
  saveAnalyticsSettings,
  sendTestAlert,
  setAppeal,
  shareCabinet,
  sharedCabinet,
  signalsFor,
  startAds,
  statusLabel,
  syncMetaCabinet,
  updateCabinet,
  updateRule,
} from "./ads.mjs";
import { clarityData, claritySync, startClaritySync } from "./clarity.mjs";
import { ga4Check, ga4Overview, ga4Realtime, ga4Status } from "./ga4.mjs";
import { HttpError, send } from "./http.mjs";
import { leads } from "./leads.mjs";
import { createLink, deleteLink, listLinks } from "./links.mjs";
import { mindmaps } from "./mindmaps.mjs";
import { createPage, deletePage, generateContent, listPages, publishApproved, setQueueStatus, updatePage, autoWarm } from "./trust.mjs";

const DAY = 86_400_000;
const PERIOD_DAYS = [1, 3, 7, 14, 30, 90];
const daysOf = (q) => {
  const d = Number(q.get("days") || 30);
  return PERIOD_DAYS.includes(d) ? d : 30;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** ?from=&to= (YYYY-MM-DD) — довільний період, не довше 400 днів */
const customOf = (q) => {
  const from = q.get("from");
  const to = q.get("to");
  if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "") || from > to) return null;
  if (Date.parse(to) - Date.parse(from) > 400 * DAY) return null;
  return { from, to };
};
const langOf = (body) => (body.lang === "uk" ? "uk" : "ru");

// ---------- заявка → кабінет ----------
/** Мапа «назва кампанії (lowercase) → id кабінету» з кампаній Meta і ручних записів */
function campaignIndex() {
  const index = new Map();
  for (const cab of activeCabinets()) {
    for (const c of cab.meta?.campaigns || []) index.set(c.name.trim().toLowerCase(), cab.id);
  }
  // ручні записи
  for (const cab of activeCabinets()) {
    const s = cabinetSummary(cab, 90);
    for (const c of s.campaigns) if (c.name && c.name !== "—") index.set(c.name.trim().toLowerCase(), cab.id);
  }
  return index;
}

const liveLeads = () => leads.filter((l) => !l.deleted);
const utmOf = (lead) => lead.attribution || {};

/** Заявки, прив'язані до кабінету, за останні days днів */
function leadsByCabinet(days, custom = null) {
  const index = campaignIndex();
  const since = custom ? Date.parse(custom.from) : Date.now() - days * DAY;
  const until = custom ? Date.parse(custom.to) + DAY : Infinity;
  const map = new Map();
  for (const lead of liveLeads()) {
    const at = new Date(lead.createdAt).getTime();
    if (at < since || at >= until) continue;
    const camp = String(utmOf(lead).utm_campaign || "").trim().toLowerCase();
    const cabId = camp && index.get(camp);
    if (!cabId) continue;
    if (!map.has(cabId)) map.set(cabId, []);
    map.get(cabId).push(lead);
  }
  return map;
}

const crmOf = (list = []) => {
  const sales = list.filter((l) => l.status === "sale");
  return { leads: list.length, sales: sales.length, revenue: Math.round(sales.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100 };
};

/** Кабінети з підсумками за період + CRM + сигнали */
export function adsSnapshot(days = 30, custom = null) {
  const crm = leadsByCabinet(days, custom);
  const list = activeCabinets().map((cab) => ({ cab, s: cabinetSummary(cab, days, custom) }));
  const revenueOf = (cab) => crmOf(crm.get(cab.id)).revenue;
  const settings = analyticsSettings();
  const signals = signalsFor(list, settings, revenueOf);
  return {
    days,
    settings,
    metaApi: metaAdsReady(),
    ai: aiReady(),
    cabinets: list.map(({ cab, s }) => ({
      ...publicCabinet(cab),
      platformLabel: platformLabel(cab.platform),
      statusLabel: statusLabel(cab.status),
      billingUrl: billingUrl(cab),
      toppedUpRecently: Boolean(cab.toppedUpAt && Date.now() - new Date(cab.toppedUpAt).getTime() < DAY),
      summary: s,
      crm: crmOf(crm.get(cab.id)),
    })),
    signals,
    rules: listRules(),
    ruleOptions: { metrics: RULE_METRICS, ops: RULE_OPS, units: RULE_UNITS, actions: RULE_ACTIONS, tags: RULE_TAGS },
    pages: listPages(),
    // кампанія → кабінет (для розбивки UTM у «Сквозной»)
    campaigns: Object.fromEntries(campaignIndex()),
  };
}

// ---------- AI: контекст ----------
function contextText(cabinetId, days = 7) {
  const snap = adsSnapshot(days);
  const list = cabinetId ? snap.cabinets.filter((c) => c.id === Number(cabinetId)) : snap.cabinets;
  if (!list.length) throw new HttpError(400, "Нет подключённых кабинетов");
  const lines = list.map((c) => {
    const s = c.summary;
    const camps = s.campaigns
      .slice(0, 6)
      .map((x) => `    · ${x.name}: расход ${x.spend}, конв ${x.conv}, CPA ${x.cpa || "—"}, CTR ${x.ctr}%${x.status ? `, статус ${x.status}` : ""}`)
      .join("\n");
    const ads = (c.meta?.ads || [])
      .slice(0, 6)
      .map((a) => `    · объявление «${a.name}»: показы ${a.impressions}, клики ${a.clicks}, расход ${a.spend}, результаты ${a.results}`)
      .join("\n");
    return [
      `- ${c.name} (${c.platformLabel}, ${c.accountId || "без ID"}), статус: ${c.statusLabel}, ниша: ${c.niche || "—"}, валюта ${c.currency}`,
      `  за ${days} дн.: расход ${s.spend}, показы ${s.impressions}, клики ${s.clicks}, CTR ${s.ctr}%, конверсии ${s.conv}, CPA ${s.cpa || "—"}, CPM ${s.cpm}`,
      `  прошлый период: расход ${s.prev.spend}, конверсии ${s.prev.conv}, CPA ${s.prev.cpa || "—"}, CTR ${s.prev.ctr}%`,
      `  сегодня: расход ${s.today.spend}, дневной бюджет ${c.budget || "не задан"}`,
      `  CRM по utm_campaign: заявок ${c.crm.leads}, продаж ${c.crm.sales}, выручка ${c.crm.revenue}`,
      camps ? `  кампании:\n${camps}` : "",
      ads ? `  объявления:\n${ads}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const alerts = snap.signals.alerts
    .filter((a) => !cabinetId || a.cabinetId === Number(cabinetId))
    .map((a) => `- ${a.acc}: ${a.kind}${a.rule ? ` (правило «${a.rule}»)` : ""}`)
    .join("\n");
  return `Данные кабинетов:\n${lines.join("\n")}\nМедианный CPA активных кабинетов: ${snap.signals.medianCpa || "—"}\nАктивные сигналы:\n${alerts || "- нет"}`;
}

// простий ліміт: 40 AI-запитів на користувача за годину
const aiCalls = new Map();
function aiLimit(user) {
  const list = (aiCalls.get(user.id) || []).filter((t) => t > Date.now() - 3_600_000);
  if (list.length >= 40) throw new HttpError(429, "Слишком много запросов к AI. Попробуйте через час");
  list.push(Date.now());
  aiCalls.set(user.id, list);
}

// ---------- маршрути ----------
export function registerAnalyticsRoutes(route) {
  const LEADS = { perm: "leads" };
  const MANAGE = { perm: "manage" };

  // Огляд: кабінети за 30 днів + лічильники
  route("GET", "/analytics/overview", LEADS, ({ res }) => {
    const snap = adsSnapshot(30);
    send(res, 200, {
      cabinets: snap.cabinets,
      medianCpa: snap.signals.medianCpa,
      mindmaps: mindmaps.filter((m) => !m.deleted).length,
    });
  });

  // ---------- кабінети ----------
  route("GET", "/analytics/ads", LEADS, ({ res, query }) => send(res, 200, adsSnapshot(daysOf(query), customOf(query))));

  route("POST", "/analytics/ads/cabinets", LEADS, ({ res, body, user }) => send(res, 201, { cabinet: publicCabinet(createCabinet(body, user)) }));

  route("PATCH", "/analytics/ads/cabinets/(\\d+)", LEADS, ({ res, body, params }) => send(res, 200, { cabinet: publicCabinet(updateCabinet(params[0], body)) }));

  route("DELETE", "/analytics/ads/cabinets/(\\d+)", MANAGE, ({ res, params }) => {
    deleteCabinet(params[0]);
    send(res, 200, { ok: true });
  });

  route("POST", "/analytics/ads/cabinets/(\\d+)/sync", LEADS, async ({ res, params }) => {
    const cab = cabinetOr404(params[0]);
    if (cab.platform !== "meta" || !metaAdsReady()) throw new HttpError(400, "Синхронизация доступна для Meta с подключённым API");
    try {
      await syncMetaCabinet(cab.id);
    } catch (error) {
      throw new HttpError(502, `Meta: ${error.message}`);
    }
    send(res, 200, { ok: true });
  });

  route("GET", "/analytics/ads/meta-accounts", LEADS, async ({ res }) => send(res, 200, { accounts: await metaAccountsList() }));

  route("GET", "/analytics/ads/cabinets/(\\d+)/stats", LEADS, ({ res, params }) => {
    cabinetOr404(params[0]);
    send(res, 200, { stats: manualStats(params[0]) });
  });

  route("POST", "/analytics/ads/cabinets/(\\d+)/stats", LEADS, ({ res, body, params, user }) => send(res, 201, { stat: addStat(params[0], body, user) }));

  route("DELETE", "/analytics/ads/cabinets/(\\d+)/stats/(\\d+)", LEADS, ({ res, params }) => {
    deleteStat(params[0], params[1]);
    send(res, 200, { ok: true });
  });

  route("POST", "/analytics/ads/cabinets/(\\d+)/topup", LEADS, ({ res, params }) => send(res, 200, { cabinet: publicCabinet(markToppedUp(params[0])) }));

  route("POST", "/analytics/ads/cabinets/(\\d+)/appeal", LEADS, ({ res, body, params, user }) => {
    const patch = {};
    if ("draft" in body) patch.draft = String(body.draft || "").slice(0, 4000);
    if (body.submitted === true) {
      patch.submittedAt = new Date().toISOString();
      patch.by = { userId: user.id, name: user.name };
    }
    send(res, 200, { cabinet: publicCabinet(setAppeal(params[0], patch)) });
  });

  route("POST", "/analytics/ads/cabinets/(\\d+)/share", LEADS, ({ res, body, params }) =>
    send(res, 200, { cabinet: publicCabinet(shareCabinet(params[0], body.enable !== false)) }),
  );

  // публічний звіт для клієнта (без входу; лише цифри кабінету)
  route("GET", "/share/([A-Za-z0-9_-]{20,})", { public: true }, ({ res, params }) => {
    const cab = sharedCabinet(params[0]);
    if (!cab) throw new HttpError(404, "Ссылка не найдена");
    const s = cabinetSummary(cab, 30);
    send(res, 200, {
      name: cab.name,
      platform: platformLabel(cab.platform),
      status: cab.status,
      currency: cab.currency,
      summary: { spend: s.spend, impressions: s.impressions, clicks: s.clicks, ctr: s.ctr, conv: s.conv, cpa: s.cpa, cpm: s.cpm, daily: s.daily, campaigns: s.campaigns.slice(0, 20), range: s.range },
      generatedAt: new Date().toISOString(),
    });
  });

  // ---------- налаштування, правила, алерти ----------
  route("PATCH", "/analytics/settings", MANAGE, ({ res, body }) => send(res, 200, { settings: saveAnalyticsSettings(body) }));

  route("POST", "/analytics/alerts/test", MANAGE, async ({ res }) => send(res, 200, { sent: await sendTestAlert(analyticsSettings()) }));

  route("POST", "/analytics/rules", MANAGE, ({ res, body, user }) => send(res, 201, { rule: createRule(body, user) }));
  route("PATCH", "/analytics/rules/(\\d+)", MANAGE, ({ res, body, params }) => send(res, 200, { rule: updateRule(params[0], body) }));
  route("DELETE", "/analytics/rules/(\\d+)", MANAGE, ({ res, params }) => {
    deleteRule(params[0]);
    send(res, 200, { ok: true });
  });

  // ---------- траст сторінок Meta ----------
  route("POST", "/analytics/pages", LEADS, ({ res, body, user }) => send(res, 201, { page: createPage(body, user) }));
  route("PATCH", "/analytics/pages/(\\d+)", LEADS, ({ res, body, params }) => send(res, 200, { page: updatePage(params[0], body) }));
  route("DELETE", "/analytics/pages/(\\d+)", LEADS, ({ res, params }) => {
    deletePage(params[0]);
    send(res, 200, { ok: true });
  });
  route("POST", "/analytics/pages/(\\d+)/generate", LEADS, async ({ res, body, params, user }) => {
    aiLimit(user);
    send(res, 200, { page: await generateContent(params[0], langOf(body)) });
  });
  route("POST", "/analytics/pages/(\\d+)/queue/([\\w-]+)", LEADS, ({ res, body, params, user }) =>
    send(res, 200, { page: setQueueStatus(params[0], params[1], body.status, user) }),
  );
  route("POST", "/analytics/pages/publish-approved", LEADS, ({ res, user }) => send(res, 200, { published: publishApproved(user) }));

  // ---------- AI-помічник ----------
  route("POST", "/analytics/ai/ask", LEADS, async ({ res, body, user }) => {
    aiLimit(user);
    const question = String(body.question || "").trim().slice(0, 1000);
    if (!question) throw new HttpError(400, "Напишите вопрос");
    const history = (Array.isArray(body.history) ? body.history : [])
      .slice(-6)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
      .map((m) => ({ role: m.role, content: m.text.slice(0, 2000) }));
    // діалог має починатися з користувача
    while (history.length && history[0].role !== "user") history.shift();
    const answer = await aiText({
      lang: langOf(body),
      system: contextText(body.cabinetId),
      messages: [...history, { role: "user", content: question }],
      maxTokens: 900,
    });
    send(res, 200, { answer });
  });

  route("POST", "/analytics/ai/ideas", LEADS, async ({ res, body, user }) => {
    aiLimit(user);
    const kind = { offers: "офферы", texts: "рекламные тексты", creatives: "креативы" }[body.kind] || "офферы";
    const ideas = await aiJson({
      lang: langOf(body),
      system: contextText(body.cabinetId, 14),
      prompt: `Предложи 4 идеи (${kind}) для теста на основе данных кабинетов. Формат: [{"t":"идея, до 60 символов","why":"почему — со ссылкой на цифры, до 200 символов","tag":"сильный|рост|тест|фикс"}]`,
    });
    send(res, 200, { ideas: (Array.isArray(ideas) ? ideas : []).slice(0, 6).map((i) => ({ t: String(i.t || "").slice(0, 120), why: String(i.why || "").slice(0, 400), tag: ["сильный", "рост", "тест", "фикс"].includes(i.tag) ? i.tag : "тест" })) });
  });

  route("POST", "/analytics/ai/cabinet", LEADS, async ({ res, body, user }) => {
    aiLimit(user);
    cabinetOr404(body.cabinetId);
    const advice = await aiText({
      lang: langOf(body),
      system: contextText(body.cabinetId, 14),
      messages: [{ role: "user", content: "Дай 3–5 конкретных советов по этому кабинету: что масштабировать, что отключить, что протестировать. Списком, коротко." }],
      maxTokens: 700,
    });
    send(res, 200, { advice });
  });

  route("POST", "/analytics/ai/appeal", LEADS, async ({ res, body, user }) => {
    aiLimit(user);
    const cab = cabinetOr404(body.cabinetId);
    const draft = await aiText({
      lang: langOf(body),
      system: "Ты пишешь вежливые, фактические апелляции в поддержку рекламной платформы. Без выдуманных фактов; места для деталей помечай [в квадратных скобках].",
      messages: [
        {
          role: "user",
          content: `Составь черновик апелляции для кабинета «${cab.name}» (${platformLabel(cab.platform)}, ${cab.accountId || "ID не указан"}), статус: ${statusLabel(cab.status)}, ниша: ${cab.niche || "не указана"}. До 900 символов.`,
        },
      ],
      maxTokens: 700,
    });
    send(res, 200, { cabinet: publicCabinet(setAppeal(cab.id, { draft, generatedAt: new Date().toISOString() })) });
  });

  route("POST", "/analytics/ai/creatives", LEADS, async ({ res, body, user }) => {
    aiLimit(user);
    const result = await aiJson({
      lang: langOf(body),
      system: contextText(body.cabinetId, 30),
      prompt: 'Для каждого объявления из данных дай одну короткую рекомендацию (до 160 символов). Формат: {"<точное название объявления>":"совет"}',
    });
    send(res, 200, { advice: result && typeof result === "object" && !Array.isArray(result) ? result : {} });
  });

  route("POST", "/analytics/ai/rule", MANAGE, async ({ res, body, user }) => {
    aiLimit(user);
    const rule = await aiJson({
      lang: langOf(body),
      system: contextText(null, 14),
      prompt: `Предложи одно автоправило для кабинетов. Формат: {"name":"до 40 символов","metric":"${RULE_METRICS.join("|")}","op":"${RULE_OPS.join("|")}","val":число,"unit":"$|%|","window":"например «за 24 часа»","actionType":"${RULE_ACTIONS.join("|")}","amount":число процентов или 0,"tag":"${RULE_TAGS.join("|")}"}`,
    });
    let created;
    try {
      created = createRule(rule || {}, user, true);
    } catch (error) {
      throw new HttpError(502, `AI предложил некорректное правило — попробуйте ещё раз (${error.message})`);
    }
    send(res, 201, { rule: created });
  });

  // ---------- UTM-посилання ----------
  route("GET", "/analytics/links", LEADS, ({ res }) => send(res, 200, { links: listLinks(), shortBase: SHORT_LINK_BASE }));
  route("POST", "/analytics/links", LEADS, ({ res, body, user }) => send(res, 201, { link: createLink(body, user) }));
  route("DELETE", "/analytics/links/(\\d+)", LEADS, ({ res, params }) => {
    deleteLink(params[0]);
    send(res, 200, { ok: true });
  });

  // ---------- GA4 ----------
  route("GET", "/analytics/ga4/status", LEADS, ({ res }) => send(res, 200, ga4Status()));
  route("POST", "/analytics/ga4/check", MANAGE, async ({ res }) => send(res, 200, await ga4Check()));
  route("GET", "/analytics/ga4", LEADS, async ({ res, query }) => {
    const custom = customOf(query);
    const period = ["7d", "28d", "30d", "90d"].includes(query.get("period")) ? query.get("period") : "28d";
    send(res, 200, await ga4Overview(custom || period));
  });
  route("GET", "/analytics/ga4/realtime", LEADS, async ({ res }) => send(res, 200, await ga4Realtime()));

  // ---------- Clarity ----------
  route("GET", "/analytics/clarity", LEADS, ({ res }) => send(res, 200, clarityData()));
  route("POST", "/analytics/clarity/sync", LEADS, async ({ res }) => {
    await claritySync({ manual: true });
    send(res, 200, clarityData());
  });
}

export function startAnalytics() {
  startAds(() => adsSnapshot(7).signals);
  startClaritySync();
  setInterval(() => autoWarm().catch(() => {}), 6 * 60 * 60_000).unref();
}

