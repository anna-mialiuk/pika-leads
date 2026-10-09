/**
 * Задачі по заявках: «перезвонити завтра о 12:00» з нагадуванням у Telegram.
 *
 * Нагадування приходить у особистий чат з ботом, якщо співробітник підключив Telegram
 * у профілі адмінки (кнопка → t.me/<бот>?start=<код>), інакше — у робочий чат заявок.
 * У нагадуванні кнопки «✅ Готово» і «⏰ +1 час».
 */
import crypto from "node:crypto";

import { ADMIN_URL, BOT_TOKEN, CHAT_IDS, TIMEZONE } from "./config.mjs";
import { users } from "./auth.mjs";
import { HttpError } from "./http.mjs";
import { leads } from "./leads.mjs";
import { answerCallback, clean, escapeHtml, telegram } from "./telegram.mjs";
import { createCollection } from "./store.mjs";

export const tasks = createCollection("tasks.json");

const now = () => new Date().toISOString();
const SNOOZE_MINUTES = 60;

const formatTime = (iso) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

const leadLabel = (lead) => lead?.data?.name || lead?.data?.phone_full || lead?.data?.email || (lead ? `Заявка #${lead.id}` : "");

export function publicTask(task) {
  const lead = task.leadId ? leads.get(task.leadId) : null;
  return {
    id: task.id,
    leadId: task.leadId || null,
    lead: lead && !lead.deleted ? { id: lead.id, name: leadLabel(lead), status: lead.status } : null,
    title: task.title,
    notes: task.notes || "",
    dueAt: task.dueAt,
    assigneeId: task.assigneeId ?? null,
    done: Boolean(task.done),
    doneAt: task.doneAt || null,
    doneBy: task.doneBy || null,
    createdBy: task.createdBy || null,
    createdAt: task.createdAt,
    remindedAt: task.remindedAt || null,
  };
}

// ---------- перевірка ----------
function parseDue(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new HttpError(400, "Укажите дату и время");
  if (time < Date.now() - 365 * 864e5 || time > Date.now() + 3 * 365 * 864e5) throw new HttpError(400, "Некорректная дата");
  return new Date(time).toISOString();
}

function validAssignee(id) {
  if (id === null || id === undefined || id === "") return null;
  const user = users.get(Number(id));
  if (!user || user.disabled) throw new HttpError(400, "Сотрудник не найден");
  return user.id;
}

function leadHistory(leadId, entry, user) {
  if (!leadId) return;
  leads.update(leadId, (l) => {
    l.history = l.history || [];
    l.history.push({ at: now(), action: "task", ...entry, by: { userId: user?.id, name: user?.name || "Telegram" } });
  });
}

// ---------- CRUD ----------
export function createTask(body, user) {
  const title = clean(body.title, 200);
  if (!title) throw new HttpError(400, "Напишите, что сделать");
  let leadId = null;
  if (body.leadId) {
    const lead = leads.get(Number(body.leadId));
    if (!lead || lead.deleted) throw new HttpError(400, "Заявка не найдена");
    leadId = lead.id;
  }
  const task = tasks.insert({
    leadId,
    title,
    notes: clean(body.notes, 2000),
    dueAt: parseDue(body.dueAt),
    assigneeId: validAssignee(body.assigneeId ?? user.id),
    done: false,
    createdBy: { userId: user.id, name: user.name },
    createdAt: now(),
    remindedAt: null,
  });
  leadHistory(leadId, { title, due: task.dueAt }, user);
  return task;
}

export function updateTask(id, body, user) {
  const task = tasks.get(id);
  if (!task || task.deleted) throw new HttpError(404, "Задача не найдена");
  const patch = {};
  if ("title" in body) {
    patch.title = clean(body.title, 200);
    if (!patch.title) throw new HttpError(400, "Напишите, что сделать");
  }
  if ("notes" in body) patch.notes = clean(body.notes, 2000);
  if ("dueAt" in body) patch.dueAt = parseDue(body.dueAt);
  if ("assigneeId" in body) patch.assigneeId = validAssignee(body.assigneeId);

  const wasDone = Boolean(task.done);
  const previousDue = task.dueAt; // task — той самий об'єкт, що й t нижче
  const updated = tasks.update(id, (t) => {
    Object.assign(t, patch);
    // новий час — нагадаємо ще раз
    if ("dueAt" in patch && patch.dueAt !== previousDue) t.remindedAt = null;
    if ("done" in body) {
      t.done = Boolean(body.done);
      t.doneAt = t.done ? now() : null;
      t.doneBy = t.done ? { userId: user?.id, name: user?.name || "Telegram" } : null;
    }
    t.updatedAt = now();
  });
  if (!wasDone && updated.done) leadHistory(updated.leadId, { title: updated.title, done: true }, user);
  return updated;
}

export function deleteTask(id, user) {
  const task = tasks.get(id);
  if (!task || task.deleted) throw new HttpError(404, "Задача не найдена");
  if (user.role !== "admin" && task.createdBy?.userId !== user.id) throw new HttpError(403, "Удалить может автор задачи или администратор");
  tasks.update(id, (t) => {
    t.deleted = true;
    t.updatedAt = now();
  });
}

export const activeTasks = () => tasks.filter((t) => !t.deleted).map(publicTask);

// ---------- Telegram: підключення особистого чату ----------
const linkCodes = new Map(); // код → { userId, exp }
let botUsername = null;

async function getBotUsername() {
  if (botUsername) return botUsername;
  const me = await telegram("getMe", {});
  botUsername = me.username;
  return botUsername;
}

export async function telegramLink(user) {
  if (!BOT_TOKEN) throw new HttpError(503, "Telegram-бот не настроен на сервере");
  const code = crypto.randomBytes(12).toString("base64url");
  linkCodes.set(code, { userId: user.id, exp: Date.now() + 15 * 60_000 });
  let username;
  try {
    username = await getBotUsername();
  } catch {
    throw new HttpError(502, "Не удалось связаться с Telegram");
  }
  return { url: `https://t.me/${username}?start=${code}` };
}

export function telegramUnlink(user) {
  users.update(user.id, (u) => {
    u.telegramChatId = null;
    u.telegramName = null;
  });
}

/** /start <код> в особистому чаті з ботом */
export async function handleTelegramMessage(message) {
  if (message?.chat?.type !== "private") return;
  const match = /^\/start\s+([\w-]{8,40})$/.exec(String(message.text || "").trim());
  if (!match) {
    if (/^\/start/.test(message.text || "")) {
      await telegram("sendMessage", { chat_id: message.chat.id, text: "Чтобы получать напоминания, нажмите «Подключить Telegram» в профиле панели Pikaleads." }).catch(() => {});
    }
    return;
  }
  const entry = linkCodes.get(match[1]);
  linkCodes.delete(match[1]);
  if (!entry || entry.exp < Date.now()) {
    await telegram("sendMessage", { chat_id: message.chat.id, text: "Ссылка устарела. Нажмите «Подключить Telegram» в профиле ещё раз." }).catch(() => {});
    return;
  }
  const user = users.update(entry.userId, (u) => {
    u.telegramChatId = message.chat.id;
    u.telegramName = message.from?.username || message.from?.first_name || "";
  });
  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text: `Готово, ${user?.name || ""}! Напоминания о задачах будут приходить сюда.`,
  }).catch(() => {});
}

setInterval(() => {
  for (const [code, entry] of linkCodes) if (entry.exp < Date.now()) linkCodes.delete(code);
}, 5 * 60_000).unref();

// ---------- нагадування ----------
const taskKeyboard = (id) => ({
  inline_keyboard: [
    [
      { text: "✅ Готово", callback_data: `task:done:${id}` },
      { text: `⏰ +1 час`, callback_data: `task:snooze:${id}` },
    ],
  ],
});

function reminderText(task) {
  const lead = task.leadId ? leads.get(task.leadId) : null;
  const assignee = task.assigneeId ? users.get(task.assigneeId) : null;
  const lines = [`⏰ <b>${escapeHtml(task.title)}</b>`, `Срок: ${formatTime(task.dueAt)}`];
  if (lead) {
    const phone = lead.data?.phone_full || lead.data?.phone || "";
    lines.push(`Заявка #${lead.id}: ${escapeHtml(leadLabel(lead))}${phone && phone !== leadLabel(lead) ? ` · ${escapeHtml(phone)}` : ""}`);
  }
  if (task.notes) lines.push(escapeHtml(task.notes));
  if (assignee && !assignee.telegramChatId) lines.push(`Для: ${escapeHtml(assignee.name)}`);
  lines.push(`<a href="${ADMIN_URL}/${lead ? `leads/${lead.id}` : "tasks"}">Открыть в панели</a>`);
  return lines.join("\n");
}

async function remind(task) {
  const assignee = task.assigneeId ? users.get(task.assigneeId) : null;
  const chatId = assignee?.telegramChatId || CHAT_IDS[0];
  if (!chatId || !BOT_TOKEN) return false;
  await telegram("sendMessage", {
    chat_id: chatId,
    text: reminderText(task),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: taskKeyboard(task.id),
  });
  return true;
}

let checking = false;
async function checkReminders() {
  if (checking) return;
  checking = true;
  try {
    const due = tasks.filter((t) => !t.deleted && !t.done && !t.remindedAt && Date.parse(t.dueAt) <= Date.now());
    for (const task of due) {
      // відмічаємо одразу — навіть якщо Telegram недоступний, не спамимо повторами
      tasks.update(task.id, (t) => {
        t.remindedAt = now();
      });
      await remind(task).catch((error) => console.error(`[tasks] напоминание #${task.id}:`, error.message));
    }
  } finally {
    checking = false;
  }
}

export function startReminders() {
  setInterval(checkReminders, 30_000).unref();
  checkReminders();
}

/** Кнопки під нагадуванням */
export async function handleTaskCallback(query) {
  const [, action, rawId] = String(query.data || "").split(":");
  const task = tasks.get(Number(rawId));
  const who = query.from?.username || query.from?.first_name || "Telegram";
  const user = users.find((u) => u.telegramChatId && String(u.telegramChatId) === String(query.from?.id)) || null;

  if (!task || task.deleted) {
    await answerCallback(query.id, "Задача не найдена");
    return;
  }
  let note;
  if (action === "done") {
    updateTask(task.id, { done: true }, user || { name: who });
    note = `✅ Выполнено · ${escapeHtml(user?.name || who)}`;
    await answerCallback(query.id, "Готово!");
  } else if (action === "snooze") {
    const dueAt = new Date(Date.now() + SNOOZE_MINUTES * 60_000).toISOString();
    updateTask(task.id, { dueAt }, user || { name: who });
    note = `⏰ Отложено до ${formatTime(dueAt)}`;
    await answerCallback(query.id, `Напомню в ${formatTime(dueAt).split(", ").pop()}`);
  } else {
    await answerCallback(query.id, "");
    return;
  }
  const message = query.message;
  if (message) {
    await telegram("editMessageText", {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: `${reminderText(tasks.get(task.id))}\n\n${note}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }).catch(() => {});
  }
}
