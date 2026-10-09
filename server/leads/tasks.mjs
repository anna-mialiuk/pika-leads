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
import { filesOf, removeFilesOf } from "./files.mjs";
import { projectExists } from "./projects.mjs";

export const tasks = createCollection("tasks.json");

const now = () => new Date().toISOString();
const SNOOZE_MINUTES = 60;

const formatTime = (iso) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

const leadLabel = (lead) => lead?.data?.name || lead?.data?.phone_full || lead?.data?.email || (lead ? `Заявка #${lead.id}` : "");

// Колонки дошки (як у макеті): done / rejected — закриті, нагадувань немає
export const TASK_STATUSES = ["todo", "inprogress", "review", "consideration", "done", "rejected"];
const CLOSED = new Set(["done", "rejected"]);
const PRIORITIES = ["low", "medium", "high"];

const statusOf = (task) => (TASK_STATUSES.includes(task.status) ? task.status : task.done ? "done" : "todo");

export function publicTask(task) {
  const lead = task.leadId ? leads.get(task.leadId) : null;
  const status = statusOf(task);
  return {
    id: task.id,
    leadId: task.leadId || null,
    lead: lead && !lead.deleted ? { id: lead.id, name: leadLabel(lead), status: lead.status } : null,
    title: task.title,
    subtitle: task.subtitle || task.notes || "",
    description: task.description || "",
    status,
    priority: PRIORITIES.includes(task.priority) ? task.priority : "medium",
    startAt: task.startAt || null,
    dueAt: task.dueAt,
    assigneeId: task.assigneeId ?? null,
    watchers: Array.isArray(task.watchers) ? task.watchers : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    projectId: task.projectId && projectExists(task.projectId) ? task.projectId : null,
    pmId: task.pmId ?? null,
    call: Boolean(task.call),
    comments: Array.isArray(task.comments) ? task.comments : [],
    timeSpent: task.timeSpent || 0,
    timerStartedAt: task.timerStartedAt || null,
    timerBy: task.timerBy || null,
    files: filesOf("task", task.id),
    done: CLOSED.has(status),
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

const parseDay = (value) => {
  if (value === null || value === "" || value === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new HttpError(400, "Некорректная дата старта");
  return String(value);
};

function validAssignee(id) {
  if (id === null || id === undefined || id === "") return null;
  const user = users.get(Number(id));
  if (!user || user.disabled) throw new HttpError(400, "Сотрудник не найден");
  return user.id;
}

const validWatchers = (list) =>
  Array.isArray(list) ? [...new Set(list.slice(0, 20).map((id) => validAssignee(id)).filter((id) => id !== null))] : [];

/** Опис — HTML з редактора: лише прості теги, без скриптів та атрибутів-обробників */
// опис задачі — HTML з редактора; лишаємо тільки дозволені теги й атрибути
const RICH_TAGS = new Set(["b", "strong", "i", "em", "u", "h3", "p", "div", "br", "ul", "ol", "li", "blockquote", "a", "span"]);
const escapeAttr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function richAttrs(tag, raw) {
  const attrs = {};
  for (const m of raw.matchAll(/([a-z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  let out = "";
  if (tag === "a") {
    const href = attrs.href?.trim() || "";
    if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) out += ` href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer"`;
  }
  if ((tag === "ul" || tag === "li") && attrs.class === "rte-check") out += ' class="rte-check"';
  if (tag === "li" && attrs["data-done"] === "1") out += ' data-done="1"';
  return out;
}

const cleanDescription = (html) =>
  String(html || "")
    .slice(0, 20000)
    .replace(/<(script|style|iframe|object|embed|svg|math|template|noscript|textarea|title)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->|<[!?][^>]*>/g, "")
    .replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (_, close, name, rest) => {
      const tag = name.toLowerCase();
      if (!RICH_TAGS.has(tag)) return "";
      return close ? `</${tag}>` : `<${tag}${richAttrs(tag, rest)}>`;
    })
    // незакритий «<тег…» у кінці — прибираємо
    .replace(/<[a-z/][^>]*$/i, "");

function cleanSubtasks(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 50).map((item, index) => {
    const title = clean(item?.title, 200);
    if (!title) throw new HttpError(400, "Пустая подзадача");
    return {
      id: clean(item.id, 20) || `s${Date.now().toString(36)}${index}`,
      title,
      done: Boolean(item.done),
      assigneeId: validAssignee(item.assigneeId),
      date: parseDay(item.date),
    };
  });
}

function leadHistory(leadId, entry, user) {
  if (!leadId) return;
  leads.update(leadId, (l) => {
    l.history = l.history || [];
    l.history.push({ at: now(), action: "task", ...entry, by: { userId: user?.id, name: user?.name || "Telegram" } });
  });
}

function validProject(id) {
  if (!id) return null;
  if (!projectExists(Number(id))) throw new HttpError(400, "Проект не найден");
  return Number(id);
}

function validLead(id) {
  if (!id) return null;
  const lead = leads.get(Number(id));
  if (!lead || lead.deleted) throw new HttpError(400, "Заявка не найдена");
  return lead.id;
}

// ---------- CRUD ----------
export function createTask(body, user) {
  const title = clean(body.title, 200);
  if (!title) throw new HttpError(400, "Напишите, что сделать");
  const status = TASK_STATUSES.includes(body.status) ? body.status : "todo";
  const leadId = validLead(body.leadId);
  const task = tasks.insert({
    leadId,
    title,
    subtitle: clean(body.subtitle ?? body.notes, 300),
    description: cleanDescription(body.description),
    status,
    priority: PRIORITIES.includes(body.priority) ? body.priority : "medium",
    startAt: parseDay(body.startAt),
    dueAt: parseDue(body.dueAt),
    assigneeId: validAssignee(body.assigneeId ?? user.id),
    watchers: validWatchers(body.watchers),
    subtasks: cleanSubtasks(body.subtasks),
    projectId: validProject(body.projectId),
    pmId: validAssignee(body.pmId),
    call: Boolean(body.call),
    comments: [],
    // таймер, запущений у чернетці нової задачі
    timeSpent: Math.max(0, Math.min(Math.floor(Number(body.timeSpent) || 0), 1000 * 3600)),
    done: CLOSED.has(status),
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
  if ("subtitle" in body) patch.subtitle = clean(body.subtitle, 300);
  if ("description" in body) patch.description = cleanDescription(body.description);
  if ("priority" in body && PRIORITIES.includes(body.priority)) patch.priority = body.priority;
  if ("startAt" in body) patch.startAt = parseDay(body.startAt);
  if ("dueAt" in body) patch.dueAt = parseDue(body.dueAt);
  if ("assigneeId" in body) patch.assigneeId = validAssignee(body.assigneeId);
  if ("watchers" in body) patch.watchers = validWatchers(body.watchers);
  if ("subtasks" in body) patch.subtasks = cleanSubtasks(body.subtasks);
  if ("leadId" in body) patch.leadId = validLead(body.leadId);
  if ("projectId" in body) patch.projectId = validProject(body.projectId);
  if ("pmId" in body) patch.pmId = validAssignee(body.pmId);
  if ("call" in body) patch.call = Boolean(body.call);
  // старий спосіб: done → колонка «Готово» / «To Do»
  let status = "status" in body ? body.status : "done" in body ? (body.done ? "done" : "todo") : undefined;
  if (status !== undefined && !TASK_STATUSES.includes(status)) throw new HttpError(400, "Неизвестный статус задачи");

  const wasDone = CLOSED.has(statusOf(task));
  const previousDue = task.dueAt; // task — той самий об'єкт, що й t нижче
  const updated = tasks.update(id, (t) => {
    Object.assign(t, patch);
    // новий час — нагадаємо ще раз
    if ("dueAt" in patch && patch.dueAt !== previousDue) t.remindedAt = null;
    if (status !== undefined) {
      t.status = status;
      t.done = CLOSED.has(status);
      if (t.done && !wasDone) {
        t.doneAt = now();
        t.doneBy = { userId: user?.id, name: user?.name || "Telegram" };
      }
      if (!t.done) {
        t.doneAt = null;
        t.doneBy = null;
      }
    }
    t.updatedAt = now();
  });
  if (!wasDone && updated.status === "done") leadHistory(updated.leadId, { title: updated.title, done: true }, user);
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
  removeFilesOf("task", task.id);
}

export function getTask(id) {
  const task = tasks.get(id);
  if (!task || task.deleted) throw new HttpError(404, "Задача не найдена");
  return task;
}

// ---------- таймер ----------
const elapsed = (task) => (task.timerStartedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(task.timerStartedAt)) / 1000)) : 0);

export function taskTimer(id, action, user) {
  const task = getTask(id);
  if (!["start", "stop", "reset"].includes(action)) throw new HttpError(400, "Неизвестное действие таймера");
  return tasks.update(task.id, (t) => {
    if (action === "start" && !t.timerStartedAt) {
      t.timerStartedAt = now();
      t.timerBy = { userId: user.id, name: user.name };
    }
    if (action === "stop" && t.timerStartedAt) {
      t.timeSpent = (t.timeSpent || 0) + elapsed(t);
      t.timerStartedAt = null;
      t.timerBy = null;
    }
    if (action === "reset") {
      t.timeSpent = 0;
      t.timerStartedAt = null;
      t.timerBy = null;
    }
  });
}

// ---------- коментарі з @згадками ----------
export async function addComment(id, body, user) {
  const task = getTask(id);
  const text = clean(body.text, 4000);
  if (!text) throw new HttpError(400, "Пустой комментарий");
  const mentions = (Array.isArray(body.mentions) ? body.mentions : [])
    .map(Number)
    .filter((uid, i, arr) => arr.indexOf(uid) === i && users.get(uid) && !users.get(uid).disabled)
    .slice(0, 20);
  const comment = {
    id: crypto.randomBytes(6).toString("hex"),
    userId: user.id,
    name: user.name,
    text,
    mentions,
    at: now(),
  };
  const updated = tasks.update(task.id, (t) => {
    t.comments = [...(t.comments || []), comment].slice(-300);
  });
  // повідомлення в Telegram тим, кого відмітили
  if (BOT_TOKEN) {
    for (const uid of mentions) {
      if (uid === user.id) continue;
      const chatId = users.get(uid)?.telegramChatId;
      if (!chatId) continue;
      telegram("sendMessage", {
        chat_id: chatId,
        text: `💬 <b>${escapeHtml(user.name)}</b> отметил(а) вас в задаче «${escapeHtml(task.title)}»:\n${escapeHtml(text.slice(0, 1000))}\n<a href="${ADMIN_URL}/tasks?task=${task.id}">Открыть задачу</a>`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }).catch((error) => console.error(`[tasks] упоминание #${task.id} → ${uid}:`, error.message));
    }
  }
  return updated;
}

export function deleteComment(id, commentId, user) {
  const task = getTask(id);
  const comment = (task.comments || []).find((c) => c.id === commentId);
  if (!comment) throw new HttpError(404, "Комментарий не найден");
  if (user.role !== "admin" && comment.userId !== user.id) throw new HttpError(403, "Удалить может автор или администратор");
  return tasks.update(task.id, (t) => {
    t.comments = t.comments.filter((c) => c.id !== commentId);
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
  if (task.subtitle || task.notes) lines.push(escapeHtml(task.subtitle || task.notes));
  if (assignee && !assignee.telegramChatId) lines.push(`Для: ${escapeHtml(assignee.name)}`);
  lines.push(`<a href="${ADMIN_URL}/tasks?task=${task.id}">Открыть задачу</a>${lead ? ` · <a href="${ADMIN_URL}/leads/${lead.id}">заявку</a>` : ""}`);
  return lines.join("\n");
}

async function remind(task) {
  if (!BOT_TOKEN) return false;
  // відповідальний + додаткові відповідальні з підключеним Telegram; нікого — загальний чат
  const people = [task.assigneeId, ...(task.watchers || [])].map((id) => (id ? users.get(id) : null)).filter(Boolean);
  const chats = [...new Set(people.map((u) => u.telegramChatId).filter(Boolean))];
  if (!chats.length && CHAT_IDS[0]) chats.push(CHAT_IDS[0]);
  for (const chatId of chats) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: reminderText(task),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: taskKeyboard(task.id),
    }).catch((error) => console.error(`[tasks] напоминание #${task.id} → ${chatId}:`, error.message));
  }
  return chats.length > 0;
}

let checking = false;
async function checkReminders() {
  if (checking) return;
  checking = true;
  try {
    const due = tasks.filter((t) => !t.deleted && !CLOSED.has(statusOf(t)) && !t.remindedAt && Date.parse(t.dueAt) <= Date.now());
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
    updateTask(task.id, { status: "done" }, user || { name: who });
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
