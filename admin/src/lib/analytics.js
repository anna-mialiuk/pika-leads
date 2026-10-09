/**
 * Аналітика заявок: усе рахується в браузері з того ж списку /leads,
 * що й CRM (заявок сотні — це миттєво й не потребує окремого API).
 */
import { sourceOf } from "./format";
import { t, tt } from "./i18n";

const DAY = 24 * 60 * 60 * 1000;

/** Етапи воронки: заявка «дійшла» до етапу, якщо колись мала один зі статусів */
export const FUNNEL = [
  { key: "all", label: t("Заявки"), statuses: null },
  {
    key: "work",
    label: t("Взяли в работу"),
    statuses: ["call", "scheduled", "no_answer", "no_pickup", "qualified", "proposal", "sale", "unqualified", "refused"],
  },
  { key: "contact", label: t("Связались"), statuses: ["scheduled", "qualified", "proposal", "sale", "unqualified", "refused"] },
  { key: "qualified", label: t("Квалифицирован"), statuses: ["qualified", "proposal", "sale"] },
  { key: "proposal", label: t("Отправили КП"), statuses: ["proposal", "sale"] },
  { key: "sale", label: t("Продажа"), statuses: ["sale"] },
];

/** Куди «зникають» заявки: поточний статус */
export const LOSSES = ["no_answer", "no_pickup", "unqualified", "refused"];

const OPEN = new Set(["new", "call", "scheduled", "no_answer", "no_pickup", "qualified", "proposal"]);

export const PERIODS = [
  { key: "7", label: t("7 дней"), days: 7 },
  { key: "30", label: t("30 дней"), days: 30 },
  { key: "90", label: t("90 дней"), days: 90 },
  { key: "all", label: t("Всё время"), days: null },
];

const startOfDay = (time) => {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Усі статуси, які мала заявка (історія + поточний) */
const statusesOf = (lead) => {
  const set = new Set([lead.status]);
  for (const h of lead.history || []) if (h.action === "status") set.add(h.to);
  return set;
};

/** Хвилин від заявки до першої дії менеджера (зміна статусу) */
const reactionMinutes = (lead) => {
  const first = (lead.history || []).find((h) => h.action === "status");
  if (!first) return null;
  const minutes = (new Date(first.at) - new Date(lead.createdAt)) / 60000;
  return minutes >= 0 ? minutes : null;
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

/** Межі періоду [from, to) і такого ж попереднього (для порівняння) */
export function periodRange(period, leads, now = Date.now()) {
  // довільний період: { from, to } — мітки часу, to не включно
  if (period.from && period.to) {
    const span = period.to - period.from;
    return { from: period.from, to: period.to, prev: { from: period.from - span, to: period.from } };
  }
  const to = startOfDay(now) + DAY;
  if (!period.days) {
    const first = leads.reduce((min, l) => Math.min(min, new Date(l.createdAt).getTime()), now);
    return { from: startOfDay(first), to, prev: null };
  }
  const from = to - period.days * DAY;
  return { from, to, prev: { from: from - period.days * DAY, to: from } };
}

const inRange = (leads, { from, to }) =>
  leads.filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return t >= from && t < to;
  });

function kpis(list) {
  const sales = list.filter((l) => l.status === "sale").length;
  const reactions = list.map(reactionMinutes).filter((m) => m !== null);
  return {
    total: list.length,
    sales,
    conversion: pct(sales, list.length),
    open: list.filter((l) => OPEN.has(l.status)).length,
    untouched: list.filter((l) => l.status === "new").length,
    reaction: median(reactions),
  };
}

// ---------- країна за кодом телефону ----------
const COUNTRIES = [
  ["380", "🇺🇦", t("Украина")],
  ["48", "🇵🇱", t("Польша")],
  ["77", "🇰🇿", t("Казахстан")],
  ["7", "🇷🇺", t("Россия")],
  ["49", "🇩🇪", t("Германия")],
  ["40", "🇷🇴", t("Румыния")],
  ["370", "🇱🇹", t("Литва")],
  ["371", "🇱🇻", t("Латвия")],
  ["372", "🇪🇪", t("Эстония")],
  ["373", "🇲🇩", t("Молдова")],
  ["375", "🇧🇾", t("Беларусь")],
  ["420", "🇨🇿", t("Чехия")],
  ["421", "🇸🇰", t("Словакия")],
  ["36", "🇭🇺", t("Венгрия")],
  ["359", "🇧🇬", t("Болгария")],
  ["43", "🇦🇹", t("Австрия")],
  ["41", "🇨🇭", t("Швейцария")],
  ["31", "🇳🇱", t("Нидерланды")],
  ["32", "🇧🇪", t("Бельгия")],
  ["33", "🇫🇷", t("Франция")],
  ["34", "🇪🇸", t("Испания")],
  ["39", "🇮🇹", t("Италия")],
  ["351", "🇵🇹", t("Португалия")],
  ["44", "🇬🇧", t("Великобритания")],
  ["353", "🇮🇪", t("Ирландия")],
  ["45", "🇩🇰", t("Дания")],
  ["46", "🇸🇪", t("Швеция")],
  ["47", "🇳🇴", t("Норвегия")],
  ["358", "🇫🇮", t("Финляндия")],
  ["30", "🇬🇷", t("Греция")],
  ["90", "🇹🇷", t("Турция")],
  ["972", "🇮🇱", t("Израиль")],
  ["971", "🇦🇪", t("ОАЭ")],
  ["995", "🇬🇪", t("Грузия")],
  ["374", "🇦🇲", t("Армения")],
  ["994", "🇦🇿", t("Азербайджан")],
  ["998", "🇺🇿", t("Узбекистан")],
  ["1", "🇺🇸", t("США / Канада")],
  ["61", "🇦🇺", t("Австралия")],
].sort((a, b) => b[0].length - a[0].length);

export function countryOf(lead) {
  const digits = String(lead.data?.phone_full || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const found = COUNTRIES.find(([code]) => digits.startsWith(code));
  return found ? { code: found[0], flag: found[1], name: found[2] } : { code: "?", flag: "🌐", name: t("Другие") };
}

/** Групування: [{ key, label, leads, sales, conversion }] за спаданням кількості */
function groupBy(list, keyOf) {
  const map = new Map();
  for (const lead of list) {
    const entry = keyOf(lead);
    if (!entry) continue;
    const row = map.get(entry.key) || { ...entry, leads: 0, sales: 0 };
    row.leads += 1;
    if (lead.status === "sale") row.sales += 1;
    map.set(entry.key, row);
  }
  return [...map.values()]
    .map((row) => ({ ...row, conversion: pct(row.sales, row.leads), share: pct(row.leads, list.length) }))
    .sort((a, b) => b.leads - a.leads || b.sales - a.sales);
}

/** Усе для сторінки аналітики */
export function analyze(allLeads, period, { users = [], types = {} } = {}) {
  const leads = allLeads.filter((l) => !l.deleted);
  const range = periodRange(period, leads);
  const list = inRange(leads, range);
  const prevList = range.prev ? inRange(leads, range.prev) : null;

  // по днях (для довгих періодів — по тижнях)
  const days = Math.round((range.to - range.from) / DAY);
  const step = days > 120 ? 7 : 1;
  const buckets = [];
  for (let t = range.from; t < range.to; t += step * DAY) buckets.push({ from: t, to: t + step * DAY, leads: 0, sales: 0 });
  for (const lead of list) {
    const t = new Date(lead.createdAt).getTime();
    const bucket = buckets[Math.min(buckets.length - 1, Math.floor((t - range.from) / (step * DAY)))];
    if (!bucket) continue;
    bucket.leads += 1;
    if (lead.status === "sale") bucket.sales += 1;
  }

  // воронка
  const reached = list.map(statusesOf);
  const funnel = FUNNEL.map((stage) => ({
    ...stage,
    count: stage.statuses ? reached.filter((set) => stage.statuses.some((s) => set.has(s))).length : list.length,
  }));
  funnel.forEach((stage, i) => {
    const next = funnel[i + 1];
    stage.toNext = next ? pct(next.count, stage.count) : null;
    stage.lost = next ? stage.count - next.count : 0;
  });
  const transitions = funnel.slice(0, -1).filter((s) => s.count > 0);
  const bottleneck = transitions.length ? transitions.reduce((worst, s) => (100 - s.toNext > 100 - worst.toNext ? s : worst)) : null;

  const losses = LOSSES.map((code) => ({ code, count: list.filter((l) => l.status === code).length }));

  const userName = (id) => users.find((u) => u.id === id)?.name;
  const managers = groupBy(list, (l) => ({
    key: l.managerId ?? "none",
    label: l.managerId ? userName(l.managerId) || `#${l.managerId}` : t("Не назначен"),
    unassigned: !l.managerId,
  })).map((row) => {
    const own = list.filter((l) => (l.managerId ?? "none") === row.key);
    return {
      ...row,
      open: own.filter((l) => OPEN.has(l.status)).length,
      reaction: median(own.map(reactionMinutes).filter((m) => m !== null)),
    };
  });

  return {
    range,
    step,
    kpi: kpis(list),
    prevKpi: prevList ? kpis(prevList) : null,
    buckets,
    funnel,
    bottleneck,
    losses,
    sources: groupBy(list, (l) => {
      const label = sourceOf(l).main;
      return { key: label.toLowerCase(), label };
    }),
    campaigns: groupBy(list, (l) => {
      const c = l.attribution?.utm_campaign;
      return c ? { key: c, label: c, source: sourceOf(l).main } : null;
    }).slice(0, 10),
    forms: groupBy(list, (l) => ({ key: l.type, label: types[l.type] || l.type })),
    countries: groupBy(list, (l) => {
      const c = countryOf(l);
      return c ? { key: c.code, label: c.name, flag: c.flag } : null;
    }),
    languages: groupBy(list, (l) => (l.lang ? { key: l.lang, label: l.lang.toUpperCase() } : null)),
    managers,
  };
}

/** «12 мин», «3,5 ч», «2 дн» */
export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return t("< 1 мин");
  if (minutes < 60) return tt("{0} мин", Math.round(minutes));
  if (minutes < 60 * 24) return tt("{0} ч", (minutes / 60).toFixed(minutes < 600 ? 1 : 0).replace(".", ","));
  return tt("{0} дн", Math.round(minutes / 60 / 24));
}
