/**
 * Заявки: створення (з сайту або вручну), статуси, менеджер, коментарі,
 * синхронізація статусу з повідомленням у Telegram в обидва боки.
 */
import fs from "node:fs";

import { LEADS_LOG } from "./config.mjs";
import { createCollection, dataPath } from "./store.mjs";
import { STATUS_BY_CODE, STATUS_BY_LABEL, isStatus } from "./statuses.mjs";
import {
  answerCallback,
  editLeadMessage,
  formatMessage,
  sendLeadMessage,
  statusFromHtml,
  withStatus,
} from "./telegram.mjs";
import { attachLeads, getTracking, pendingValue, trackNewLead, trackStatus } from "./tracking.mjs";

export const leads = createCollection("leads.json");
attachLeads(leads);

const now = () => new Date().toISOString();

const actorOf = (user) =>
  user ? { userId: user.id, name: user.name } : { name: "Система" };

function addHistory(lead, entry) {
  lead.history = lead.history || [];
  lead.history.push({ at: now(), ...entry });
}

// ---------- створення ----------
export async function createLead(payload, { ip, user } = {}) {
  const record = {
    type: payload.type,
    source: payload.source || "",
    page: payload.page || "",
    lang: payload.lang || "",
    title: payload.title || "",
    data: payload.data || {},
    attribution: payload.attribution || {},
    ip: ip || "",
    createdAt: now(),
    status: "new",
    managerId: null,
    comments: [],
    history: [],
    telegram: null,
    // для реклами: event_id пікселя, _fbp/_fbc, client_id GA4, браузер, згода на cookie
    tracking: payload.tracking || null,
    amount: null,
    events: [],
  };

  // резервний журнал — як і раніше, рядок на кожну заявку
  try {
    fs.appendFileSync(LEADS_LOG, `${JSON.stringify({ ...payload, ip, receivedAt: record.createdAt })}\n`);
  } catch (error) {
    console.error("[leads] не вдалося записати журнал:", error.message);
  }

  const lead = leads.insert(record);
  leads.update(lead.id, (l) => addHistory(l, { action: "created", by: actorOf(user) }));

  // Meta Conversions API — у фоні, відповідь сайту не чекає
  trackNewLead(leads.get(lead.id)).catch((error) => console.error("[tracking]", error.message));

  // ручні заявки з адмінки в Telegram не надсилаємо
  if (payload.type !== "manual") {
    try {
      const html = formatMessage(lead);
      const messages = await sendLeadMessage(html);
      if (messages.length) {
        leads.update(lead.id, (l) => {
          l.telegram = { html, messages };
        });
      }
    } catch (error) {
      console.error("[leads] Telegram:", error.message);
    }
  }

  return lead;
}

// ---------- статус ----------
async function syncTelegram(lead, who) {
  if (!lead.telegram?.messages?.length) return;
  const status = STATUS_BY_CODE[lead.status];
  const html = withStatus(lead.telegram.html, status.label, who);
  leads.update(lead.id, (l) => {
    l.telegram.html = html;
  });
  await Promise.all(
    lead.telegram.messages.map((ref) =>
      editLeadMessage(ref, html).catch((error) =>
        console.error("[leads] оновлення повідомлення:", error.message),
      ),
    ),
  );
}

export async function setStatus(id, status, { user, telegramUser } = {}) {
  if (!isStatus(status)) throw Object.assign(new Error("Неизвестный статус"), { status: 400 });
  const lead = leads.get(id);
  if (!lead || lead.deleted) return null;
  if (lead.status === status) return lead;

  const from = lead.status;
  const by = telegramUser ? { name: telegramUser, via: "telegram" } : actorOf(user);
  leads.update(id, (l) => {
    l.status = status;
    l.updatedAt = now();
    addHistory(l, { action: "status", from, to: status, by });
  });

  await syncTelegram(lead, by.name);
  trackStatus(leads.get(id)).catch((error) => console.error("[tracking]", error.message));
  return lead;
}

/** Сума угоди (для події «Покупка» в Meta / GA4) */
export function setAmount(id, amount, { user } = {}) {
  const lead = leads.get(id);
  if (!lead || lead.deleted) return null;
  const value = amount === null || amount === "" ? null : Math.round(Number(amount) * 100) / 100;
  if (value !== null && !(value >= 0 && value < 1e9)) throw Object.assign(new Error("Некорректная сумма"), { status: 400 });
  if (lead.amount === value) return lead;
  const updated = leads.update(id, (l) => {
    l.amount = value;
    l.currency = l.currency || getTracking().currency;
    l.updatedAt = now();
    addHistory(l, { action: "amount", to: value, currency: l.currency, by: actorOf(user) });
  });
  trackStatus(updated).catch((error) => console.error("[tracking]", error.message));
  return updated;
}

export function setManager(id, managerId, { user } = {}) {
  const lead = leads.get(id);
  if (!lead || lead.deleted) return null;
  const from = lead.managerId;
  if (from === managerId) return lead;
  return leads.update(id, (l) => {
    l.managerId = managerId;
    l.updatedAt = now();
    addHistory(l, { action: "manager", from, to: managerId, by: actorOf(user) });
  });
}

export function addComment(id, text, { user }) {
  const lead = leads.get(id);
  if (!lead || lead.deleted) return null;
  return leads.update(id, (l) => {
    const comments = l.comments || (l.comments = []);
    const nextId = comments.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    comments.push({ id: nextId, userId: user.id, name: user.name, text, at: now() });
    l.updatedAt = now();
  });
}

export function deleteLead(id, { user }) {
  return leads.update(id, (l) => {
    l.deleted = true;
    l.updatedAt = now();
    addHistory(l, { action: "deleted", by: actorOf(user) });
  });
}

// ---------- натискання кнопки в Telegram ----------
export async function handleTelegramCallback(query) {
  const code = (query.data || "").replace(/^st:/, "");
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const who =
    query.from?.username ||
    [query.from?.first_name, query.from?.last_name].filter(Boolean).join(" ") ||
    "Telegram";

  const lead = leads.find((l) =>
    l.telegram?.messages?.some(
      (m) => String(m.chatId) === String(chatId) && m.messageId === messageId,
    ),
  );

  if (!isStatus(code) || !lead) {
    await answerCallback(query.id, "Заявка не найдена");
    return;
  }

  await setStatus(lead.id, code, { telegramUser: who });
  await answerCallback(query.id, `Статус: ${STATUS_BY_CODE[code].label}`);
}

// ---------- міграція: старий журнал leads.jsonl → CRM ----------
/**
 * Одноразово при першому запуску: переносить заявки з leads.jsonl у leads.json.
 * Статус і повідомлення Telegram підтягуються з messages.jsonl (старий формат):
 * повідомлення зіставляється із заявкою за номером телефону та порядком.
 */
export function migrateLegacyLeads() {
  // лише коли CRM ще не створена — і ніколи повторно (навіть якщо записів 0)
  if (leads.existed || leads.size > 0) return 0;

  let lines = [];
  try {
    lines = fs.readFileSync(LEADS_LOG, "utf8").split("\n").filter(Boolean);
  } catch {
    return 0;
  }

  const legacy = [];
  for (const line of lines) {
    try {
      legacy.push(JSON.parse(line));
    } catch {
      /* пошкоджений рядок пропускаємо */
    }
  }
  if (!legacy.length) return 0;

  // останній стан кожного повідомлення
  const messages = new Map();
  try {
    for (const line of fs.readFileSync(dataPath("messages.jsonl"), "utf8").split("\n")) {
      if (!line) continue;
      const { key, html } = JSON.parse(line);
      messages.set(key, html);
    }
  } catch {
    /* файла немає */
  }

  const digits = (value) => String(value || "").replace(/\D/g, "");
  const pending = [...messages.entries()].map(([key, html]) => {
    const [chatId, messageId] = key.split(":");
    const phone = (html.match(/href="tel:([^"]+)"/) || [])[1];
    return { chatId, messageId: Number(messageId), html, phone: digits(phone), used: false };
  });

  const imported = [];
  for (const item of legacy) {
    const data = item.data || {};
    const phone = digits(data.phone_full || data.phone);
    const match = phone && pending.find((m) => !m.used && m.phone === phone);
    let status = "new";
    let telegram = null;
    let statusBy = "";

    if (match) {
      match.used = true;
      const parsed = statusFromHtml(match.html);
      const found = parsed && STATUS_BY_LABEL[parsed.label];
      if (found) {
        status = found.code;
        statusBy = parsed.who;
      }
      telegram = { html: match.html, messages: [{ chatId: match.chatId, messageId: match.messageId }] };
    }

    const createdAt = item.receivedAt || now();
    const history = [{ at: createdAt, action: "created", by: { name: "Импорт" } }];
    if (status !== "new") {
      history.push({ at: createdAt, action: "status", from: "new", to: status, by: { name: statusBy || "Telegram", via: "telegram" } });
    }

    imported.push({
      type: item.type,
      source: item.source || "",
      page: item.page || "",
      lang: item.lang || "",
      title: item.title || "",
      data,
      attribution: item.attribution || {},
      ip: item.ip || "",
      createdAt,
      status,
      managerId: null,
      comments: [],
      history,
      telegram,
    });
  }

  leads.insertMany(imported);
  console.log(`[leads] імпортовано ${legacy.length} заявок з ${LEADS_LOG}`);
  return legacy.length;
}

/** Заявка для відповіді API */
export const publicLead = (lead) => {
  const { deleted, tracking, ...rest } = lead;
  return {
    ...rest,
    telegram: lead.telegram ? { messages: lead.telegram.messages.length } : null,
    // технічні дані для реклами не показуємо — лише що є
    tracking: tracking
      ? { consent: tracking.consent || null, meta: Boolean(tracking.fbp || tracking.fbc), ga: Boolean(tracking.gaClientId) }
      : null,
    currency: lead.currency || getTracking().currency,
    awaitingAmount: pendingValue(lead),
  };
};
