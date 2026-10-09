/**
 * Звонки й митинги команди (розділ «Задачи → Звонки»): тижнева сітка, посилання для підключення.
 * Учасникам із підключеним Telegram приходить запрошення, а за 15 хвилин до початку — нагадування з посиланням.
 */
import { ADMIN_URL, BOT_TOKEN, TIMEZONE } from "./config.mjs";
import { can, users } from "./auth.mjs";
import { HttpError } from "./http.mjs";
import { projectExists } from "./projects.mjs";
import { createCollection } from "./store.mjs";
import { clean, escapeHtml, telegram } from "./telegram.mjs";

export const meetings = createCollection("meetings.json");

export const MEET_TYPES = ["meeting", "call"];
export const MEET_VIDEO = ["zoom", "googlemeet", "loom", ""];
const VIDEO_LABELS = { zoom: "Zoom", googlemeet: "Google Meet", loom: "Loom" };
const REMIND_BEFORE = 15 * 60_000;

const now = () => new Date().toISOString();

const formatWhen = (iso) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: TIMEZONE, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

export const publicMeeting = (m) => ({
  id: m.id,
  title: m.title,
  startAt: m.startAt,
  duration: m.duration,
  type: m.type,
  video: m.video || "",
  link: m.link || "",
  attendees: m.attendees || [],
  projectId: m.projectId && projectExists(m.projectId) ? m.projectId : null,
  notes: m.notes || "",
  createdBy: m.createdBy || null,
  createdAt: m.createdAt,
});

export const activeMeetings = () =>
  meetings
    .filter((m) => !m.deleted && Date.parse(m.startAt) > Date.now() - 120 * 864e5)
    .map(publicMeeting);

function fields(body, partial) {
  const out = {};
  if (!partial || "title" in body) {
    out.title = clean(body.title, 160);
    if (!out.title) throw new HttpError(400, "Укажите название встречи");
  }
  if (!partial || "startAt" in body) {
    const time = Date.parse(body.startAt);
    if (!Number.isFinite(time)) throw new HttpError(400, "Укажите дату и время");
    if (time < Date.now() - 365 * 864e5 || time > Date.now() + 2 * 365 * 864e5) throw new HttpError(400, "Некорректная дата");
    out.startAt = new Date(time).toISOString();
  }
  if (!partial || "duration" in body) {
    const duration = Math.round(Number(body.duration) || 60);
    if (duration < 5 || duration > 600) throw new HttpError(400, "Длительность от 5 минут до 10 часов");
    out.duration = duration;
  }
  if ("type" in body) out.type = MEET_TYPES.includes(body.type) ? body.type : "meeting";
  if ("video" in body) out.video = MEET_VIDEO.includes(body.video) ? body.video : "";
  if ("link" in body) {
    const link = clean(body.link, 500);
    if (link && !/^https:\/\/[^\s"'<>]+$/i.test(link)) throw new HttpError(400, "Ссылка на звонок должна начинаться с https://");
    out.link = link;
  }
  if ("attendees" in body) {
    out.attendees = Array.isArray(body.attendees)
      ? [...new Set(body.attendees.map(Number))].filter((id) => users.get(id) && !users.get(id).disabled).slice(0, 50)
      : [];
  }
  if ("projectId" in body) {
    out.projectId = body.projectId ? Number(body.projectId) : null;
    if (out.projectId && !projectExists(out.projectId)) throw new HttpError(400, "Проект не найден");
  }
  if ("notes" in body) out.notes = clean(body.notes, 2000);
  return out;
}

function meetingText(m, header) {
  const lines = [`${header} <b>${escapeHtml(m.title)}</b>`, `${formatWhen(m.startAt)} · ${m.duration} мин · ${m.type === "call" ? "звонок" : "митинг"}`];
  if (m.link) lines.push(`📹 ${VIDEO_LABELS[m.video] || "Ссылка"}: ${escapeHtml(m.link)}`);
  const names = (m.attendees || []).map((id) => users.get(id)?.name).filter(Boolean);
  if (names.length) lines.push(`Участники: ${escapeHtml(names.join(", "))}`);
  lines.push(`<a href="${ADMIN_URL}/tasks/calls">Открыть в панели</a>`);
  return lines.join("\n");
}

async function notify(m, header, userIds) {
  if (!BOT_TOKEN) return;
  for (const uid of new Set(userIds)) {
    const chatId = users.get(uid)?.telegramChatId;
    if (!chatId) continue;
    await telegram("sendMessage", {
      chat_id: chatId,
      text: meetingText(m, header),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(m.link ? { reply_markup: { inline_keyboard: [[{ text: "Войти в звонок", url: m.link }]] } } : {}),
    }).catch((error) => console.error(`[meetings] #${m.id} → ${uid}:`, error.message));
  }
}

export function createMeeting(body, user) {
  const data = fields(body, false);
  const m = meetings.insert({
    type: "meeting",
    video: "",
    link: "",
    attendees: [],
    projectId: null,
    notes: "",
    ...data,
    createdBy: { userId: user.id, name: user.name },
    createdAt: now(),
    remindedAt: null,
  });
  // запрошення всім, крім автора
  notify(m, "📅 Вас пригласили:", m.attendees.filter((id) => id !== user.id));
  return publicMeeting(m);
}

function getMeeting(id) {
  const m = meetings.get(id);
  if (!m || m.deleted) throw new HttpError(404, "Встреча не найдена");
  return m;
}

const canEdit = (m, user) => can(user, "manage") || m.createdBy?.userId === user.id || (m.attendees || []).includes(user.id);

export function updateMeeting(id, body, user) {
  const m = getMeeting(id);
  if (!canEdit(m, user)) throw new HttpError(403, "Изменять встречу может автор, участник или администратор");
  const data = fields(body, true);
  const before = new Set(m.attendees || []);
  const previousStart = m.startAt;
  const updated = meetings.update(m.id, (x) => {
    Object.assign(x, data);
    if (data.startAt && data.startAt !== previousStart) x.remindedAt = null;
    x.updatedAt = now();
  });
  const added = (updated.attendees || []).filter((uid) => !before.has(uid) && uid !== user.id);
  if (added.length) notify(updated, "📅 Вас пригласили:", added);
  if (data.startAt && data.startAt !== previousStart) {
    notify(updated, "🔁 Встреча перенесена:", (updated.attendees || []).filter((uid) => before.has(uid) && uid !== user.id));
  }
  return publicMeeting(updated);
}

export function deleteMeeting(id, user) {
  const m = getMeeting(id);
  if (!can(user, "manage") && m.createdBy?.userId !== user.id) throw new HttpError(403, "Удалить может автор или администратор");
  meetings.update(m.id, (x) => {
    x.deleted = true;
    x.updatedAt = now();
  });
  if (Date.parse(m.startAt) > Date.now()) notify(m, "❌ Встреча отменена:", (m.attendees || []).filter((uid) => uid !== user.id));
}

// ---------- нагадування за 15 хвилин ----------
let checking = false;
async function checkMeetings() {
  if (checking) return;
  checking = true;
  try {
    const soon = meetings.filter((m) => {
      if (m.deleted || m.remindedAt) return false;
      const start = Date.parse(m.startAt);
      return start - Date.now() <= REMIND_BEFORE && start > Date.now() - 5 * 60_000;
    });
    for (const m of soon) {
      meetings.update(m.id, (x) => {
        x.remindedAt = now();
      });
      await notify(m, "⏰ Через 15 минут:", [...(m.attendees || []), m.createdBy?.userId].filter(Boolean));
    }
  } finally {
    checking = false;
  }
}

export function startMeetingReminders() {
  setInterval(checkMeetings, 30_000).unref();
  checkMeetings();
}
