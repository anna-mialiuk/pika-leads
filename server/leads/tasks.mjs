/**
 * Задачі по заявках: «перезвонити завтра о 12:00» з нагадуванням у Telegram.
 *
 * Нагадування приходить у особистий чат з ботом, якщо співробітник підключив Telegram
 * у профілі адмінки (кнопка → t.me/<бот>?start=<код>), інакше — у робочий чат заявок.
 * У нагадуванні кнопки «✅ Готово» і «⏰ +1 час».
 */
import crypto from "node:crypto";

import { ADMIN_URL, BOT_TOKEN, CHAT_IDS, TIMEZONE } from "./config.mjs";
import { can, users } from "./auth.mjs";
import { HttpError } from "./http.mjs";
import { leads } from "./leads.mjs";
import { answerCallback, clean, escapeHtml, telegram } from "./telegram.mjs";
import { createCollection } from "./store.mjs";
import { filesOf, removeFilesOf } from "./files.mjs";
import { activeProjects, projectExists } from "./projects.mjs";
import { columnKeys, columnLabel, getTaskSettings, isClosedStatus, notifyOn } from "./task-settings.mjs";

export const tasks = createCollection("tasks.json");

const now = () => new Date().toISOString();
const SNOOZE_MINUTES = 60;

const formatTime = (iso) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

const leadLabel = (lead) => lead?.data?.name || lead?.data?.phone_full || lead?.data?.email || (lead ? `Заявка #${lead.id}` : "");

// Колонки дошки (як у макеті): done / rejected — закриті, нагадувань немає
// колонки налаштовуються в «Задачи → Настройки»; «done» / «rejected» — закриті
const CLOSED = { has: (key) => isClosedStatus(key) };
const PRIORITIES = ["low", "medium", "high"];

const statusOf = (task) => (columnKeys().includes(task.status) ? task.status : task.done ? "done" : "todo");

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
    postponed: task.postponed || 0,
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
  const status = columnKeys().includes(body.status) ? body.status : "todo";
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
  if (task.assigneeId && task.assigneeId !== user.id) notifyAssigned(task, user);
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
  if (status !== undefined && !columnKeys().includes(status)) throw new HttpError(400, "Неизвестный статус задачи");

  const wasDone = CLOSED.has(statusOf(task));
  const previousDue = task.dueAt; // task — той самий об'єкт, що й t нижче
  const previousAssignee = task.assigneeId;
  const updated = tasks.update(id, (t) => {
    Object.assign(t, patch);
    // новий час — нагадаємо ще раз
    if ("dueAt" in patch && patch.dueAt !== previousDue) {
      t.remindedAt = null;
      t.remindedDayAt = null;
      // перенос дедлайну пізніше — рахуємо для аналітики («📉 Потеря»)
      if (Date.parse(patch.dueAt) > Date.parse(previousDue)) t.postponed = (t.postponed || 0) + 1;
    }
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
  if (updated.assigneeId && updated.assigneeId !== previousAssignee && updated.assigneeId !== user?.id) notifyAssigned(updated, user);
  return updated;
}

export function deleteTask(id, user) {
  const task = tasks.get(id);
  if (!task || task.deleted) throw new HttpError(404, "Задача не найдена");
  if (!can(user, "manage") && task.createdBy?.userId !== user.id) throw new HttpError(403, "Удалить может автор задачи или администратор");
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

// ---------- особисті сповіщення ----------
function sendToUser(uid, text, extra = {}) {
  const chatId = users.get(uid)?.telegramChatId;
  if (!BOT_TOKEN || !chatId) return;
  telegram("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }).catch((error) =>
    console.error(`[tasks] сообщение → ${uid}:`, error.message),
  );
}

function notifyAssigned(task, by) {
  if (!notifyOn("assign")) return;
  sendToUser(
    task.assigneeId,
    `📌 <b>Новая задача</b> от ${escapeHtml(by?.name || "Telegram")}:\n<b>${escapeHtml(task.title)}</b>\nСрок: ${formatTime(task.dueAt)}\n<a href="${ADMIN_URL}/tasks?task=${task.id}">Открыть задачу</a>`,
    { reply_markup: taskKeyboard(task.id) },
  );
}

/** Задачі видалених колонок → «To Do» */
export function moveTasksFromColumns(keys) {
  if (!keys.length) return 0;
  let moved = 0;
  for (const t of tasks.filter((x) => !x.deleted && keys.includes(x.status))) {
    tasks.update(t.id, (x) => {
      x.status = "todo";
      x.done = false;
    });
    moved++;
  }
  return moved;
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
  // решта учасників задачі — якщо увімкнено «Комментарии»
  if (BOT_TOKEN && notifyOn("comment")) {
    const others = [task.assigneeId, ...(task.watchers || []), task.pmId, task.createdBy?.userId].filter(
      (uid) => uid && uid !== user.id && !mentions.includes(uid),
    );
    for (const uid of new Set(others)) {
      sendToUser(uid, `💬 <b>${escapeHtml(user.name)}</b> в задаче «${escapeHtml(task.title)}»:\n${escapeHtml(text.slice(0, 1000))}\n<a href="${ADMIN_URL}/tasks?task=${task.id}">Открыть задачу</a>`);
    }
  }
  return updated;
}

export function deleteComment(id, commentId, user) {
  const task = getTask(id);
  const comment = (task.comments || []).find((c) => c.id === commentId);
  if (!comment) throw new HttpError(404, "Комментарий не найден");
  if (!can(user, "manage") && comment.userId !== user.id) throw new HttpError(403, "Удалить может автор или администратор");
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
  if (await handleCreateDialog(message)) return;
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
    // за добу до дедлайну (якщо задачу ставили раніше, ніж за добу)
    if (notifyOn("deadline")) {
      const soon = tasks.filter(
        (t) =>
          !t.deleted &&
          !CLOSED.has(statusOf(t)) &&
          !t.remindedDayAt &&
          Date.parse(t.dueAt) - Date.now() <= 864e5 &&
          Date.parse(t.dueAt) - Date.now() > 60 * 60_000 &&
          Date.parse(t.dueAt) - Date.parse(t.createdAt) > 864e5,
      );
      for (const task of soon) {
        tasks.update(task.id, (t) => {
          t.remindedDayAt = now();
        });
        for (const uid of new Set([task.assigneeId, ...(task.watchers || [])].filter(Boolean))) {
          sendToUser(uid, `🔔 Завтра дедлайн: <b>${escapeHtml(task.title)}</b>\nСрок: ${formatTime(task.dueAt)}\n<a href="${ADMIN_URL}/tasks?task=${task.id}">Открыть задачу</a>`);
        }
      }
    }
    const due = tasks.filter((t) => !t.deleted && !CLOSED.has(statusOf(t)) && !t.remindedAt && Date.parse(t.dueAt) <= Date.now());
    // «Просроченные задачи» вимкнено — лише відмічаємо, без повідомлень
    if (!notifyOn("overdue")) {
      for (const task of due) tasks.update(task.id, (t) => (t.remindedAt = now()));
      return;
    }
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
  // команда /task у меню бота (особисті чати)
  if (BOT_TOKEN) {
    telegram("setMyCommands", {
      commands: [{ command: "task", description: "Новая задача" }],
      scope: { type: "all_private_chats" },
    }).catch(() => {});
  }
}

/** Ім'я бота для сторінки налаштувань */
export async function botInfo() {
  if (!BOT_TOKEN) return { configured: false, username: null };
  try {
    return { configured: true, username: await getBotUsername() };
  } catch {
    return { configured: true, username: null };
  }
}

/** Кнопки під нагадуванням */
export async function handleTaskCallback(query) {
  if (String(query.data || "").startsWith("task:new:")) return handleCreateCallback(query);
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

// ---------- постановка задачі з Telegram: /task ----------
// Кроки: назва → дедлайн → проект → відповідальний. Стан — у пам'яті, 15 хвилин.
const dialogs = new Map(); // chatId → { step, data, exp, userId }
const DIALOG_TTL = 15 * 60_000;

/** Зсув часового поясу TIMEZONE (мс) для моменту date */
function tzOffset(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Місцевий час (TIMEZONE) → Date */
function zoned(y, m, d, h, min) {
  const guess = Date.UTC(y, m, d, h, min);
  return new Date(guess - tzOffset(new Date(guess)));
}

function todayParts(shiftDays = 0) {
  const nowLocal = new Date(Date.now() + tzOffset(new Date()));
  const d = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate() + shiftDays));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() };
}

const DUE_BUTTONS = [
  { key: "t18", text: "Сегодня 18:00", get: () => ({ ...todayParts(0), h: 18 }) },
  { key: "m10", text: "Завтра 10:00", get: () => ({ ...todayParts(1), h: 10 }) },
  { key: "m15", text: "Завтра 15:00", get: () => ({ ...todayParts(1), h: 15 }) },
  { key: "d3", text: "Через 3 дня", get: () => ({ ...todayParts(3), h: 10 }) },
  {
    key: "mon",
    text: "В понедельник",
    get: () => {
      const wd = todayParts(0).wd;
      return { ...todayParts((8 - wd) % 7 || 7), h: 10 };
    },
  },
];

/** «08.07 15:00», «8.7.2026», «08.07» (10:00) */
function parseUserDate(text) {
  const m = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?:\s+(\d{1,2})[:.](\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const today = todayParts(0);
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.y;
  const month = Number(m[2]) - 1;
  const day = Number(m[1]);
  const hour = m[4] ? Number(m[4]) : 10;
  const minute = m[5] ? Number(m[5]) : 0;
  if (month > 11 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  let date = zoned(year, month, day, hour, minute);
  if (!m[3] && date < Date.now() - 864e5) date = zoned(++year, month, day, hour, minute);
  return date;
}

const send = (chatId, text, keyboard) =>
  telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  }).catch((error) => console.error("[tasks] /task:", error.message));

const rows = (buttons, perRow = 2) => {
  const out = [];
  for (let i = 0; i < buttons.length; i += perRow) out.push(buttons.slice(i, i + perRow));
  return out;
};

async function askDue(chatId) {
  await send(
    chatId,
    "🤖 Дедлайн? Выберите или напишите дату: <code>08.07 15:00</code>",
    rows(DUE_BUTTONS.map((b) => ({ text: b.text, callback_data: `task:new:due:${b.key}` }))),
  );
}

async function askProject(chatId) {
  const list = activeProjects()
    .filter((p) => p.status !== "done")
    .slice(0, 10);
  if (!list.length) return false;
  await send(chatId, "🤖 Проект?", [
    ...rows(list.map((p) => ({ text: `${p.icon} ${p.name}`.slice(0, 60), callback_data: `task:new:proj:${p.id}` }))),
    [{ text: "Без проекта", callback_data: "task:new:proj:0" }],
  ]);
  return true;
}

async function askAssignee(chatId, user) {
  const team = users
    .filter((u) => !u.disabled)
    .slice(0, 16)
    .map((u) => ({ text: u.id === user.id ? `${u.name} (я)` : u.name, callback_data: `task:new:who:${u.id}` }));
  await send(chatId, "🤖 Ответственный?", rows(team));
}

async function finishCreate(chatId, dialog, user) {
  dialogs.delete(chatId);
  try {
    const task = createTask(
      {
        title: dialog.data.title,
        dueAt: dialog.data.dueAt,
        projectId: dialog.data.projectId || null,
        assigneeId: dialog.data.assigneeId ?? user.id,
        status: "todo",
      },
      user,
    );
    const project = task.projectId ? activeProjects().find((p) => p.id === task.projectId) : null;
    const assignee = users.get(task.assigneeId);
    await send(
      chatId,
      [
        `✅ Задача создана в колонке «${escapeHtml(columnLabel("todo"))}»`,
        `<b>${escapeHtml(task.title)}</b>`,
        `Срок: ${formatTime(task.dueAt)}`,
        project ? `Проект: ${escapeHtml(project.name)}` : "",
        assignee ? `Ответственный: ${escapeHtml(assignee.name)}` : "",
        `<a href="${ADMIN_URL}/tasks?task=${task.id}">Открыть в панели</a>`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } catch (error) {
    await send(chatId, `⚠ Не удалось создать задачу: ${escapeHtml(error.message)}`);
  }
}

const linkedUser = (chatId) => users.find((u) => !u.disabled && u.telegramChatId && String(u.telegramChatId) === String(chatId)) || null;

/** Повертає true, якщо повідомлення оброблене діалогом */
async function handleCreateDialog(message) {
  const chatId = message.chat.id;
  const text = String(message.text || "").trim();
  if (!text) return false;
  const command = /^\/task(?:@\w+)?(?:\s+([\s\S]+))?$/i.exec(text);
  const dialog = dialogs.get(chatId);

  if (/^\/cancel/i.test(text) && dialog) {
    dialogs.delete(chatId);
    await send(chatId, "Отменено.");
    return true;
  }
  if (command) {
    const user = linkedUser(chatId);
    if (!getTaskSettings().telegramCreate) {
      await send(chatId, "Создание задач из Telegram выключено в настройках панели.");
      return true;
    }
    if (!user) {
      await send(chatId, "Сначала подключите Telegram в профиле панели Pikaleads (кнопка «Подключить Telegram»).");
      return true;
    }
    const title = clean(command[1], 200);
    const next = { step: title ? "due" : "title", data: { title }, exp: Date.now() + DIALOG_TTL, userId: user.id };
    dialogs.set(chatId, next);
    if (title) await askDue(chatId);
    else await send(chatId, "🤖 Введите название задачи\n<i>/cancel — отменить</i>");
    return true;
  }
  if (!dialog || dialog.exp < Date.now() || text.startsWith("/")) {
    if (dialog) dialogs.delete(chatId);
    return false;
  }
  dialog.exp = Date.now() + DIALOG_TTL;
  const user = users.get(dialog.userId);
  if (dialog.step === "title") {
    dialog.data.title = clean(text, 200);
    dialog.step = "due";
    await askDue(chatId);
    return true;
  }
  if (dialog.step === "due") {
    const date = parseUserDate(text);
    if (!date) {
      await send(chatId, "Не понял дату. Напишите, например, <code>08.07 15:00</code> или нажмите кнопку.");
      return true;
    }
    dialog.data.dueAt = date.toISOString();
    dialog.step = "proj";
    if (!(await askProject(chatId))) {
      dialog.step = "who";
      await askAssignee(chatId, user);
    }
    return true;
  }
  // на кроках з кнопками текст не чекаємо
  await send(chatId, "Выберите вариант кнопкой выше или /cancel.");
  return true;
}

async function handleCreateCallback(query) {
  const [, , step, value] = String(query.data).split(":");
  const chatId = query.message?.chat?.id ?? query.from?.id;
  const dialog = dialogs.get(chatId);
  if (!dialog || dialog.exp < Date.now() || dialog.step !== step) {
    await answerCallback(query.id, "Начните заново: /task");
    return;
  }
  const user = users.get(dialog.userId);
  dialog.exp = Date.now() + DIALOG_TTL;
  // прибираємо кнопки з попереднього питання
  if (query.message) {
    telegram("editMessageReplyMarkup", { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  }
  if (step === "due") {
    const preset = DUE_BUTTONS.find((b) => b.key === value);
    if (!preset) return answerCallback(query.id, "");
    const p = preset.get();
    dialog.data.dueAt = zoned(p.y, p.m, p.d, p.h, 0).toISOString();
    await answerCallback(query.id, preset.text);
    dialog.step = "proj";
    if (!(await askProject(chatId))) {
      dialog.step = "who";
      await askAssignee(chatId, user);
    }
    return;
  }
  if (step === "proj") {
    dialog.data.projectId = Number(value) || null;
    await answerCallback(query.id, "");
    dialog.step = "who";
    await askAssignee(chatId, user);
    return;
  }
  if (step === "who") {
    dialog.data.assigneeId = Number(value) || user.id;
    await answerCallback(query.id, "Создаю…");
    await finishCreate(chatId, dialog, user);
  }
}

setInterval(() => {
  for (const [chatId, d] of dialogs) if (d.exp < Date.now()) dialogs.delete(chatId);
}, 5 * 60_000).unref();
