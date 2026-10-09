/**
 * Проекти (як у макеті): назва, ніша/клієнт, PM, байєри й команда, терміни, статус, колір, іконка,
 * історія созвонів із саммері, файли проекту. Задачі прив'язуються через task.projectId.
 */
import crypto from "node:crypto";

import { can, users } from "./auth.mjs";
import { filesOf, removeFilesOf } from "./files.mjs";
import { HttpError } from "./http.mjs";
import { createCollection } from "./store.mjs";
import { clean } from "./telegram.mjs";

export const projects = createCollection("projects.json");

export const PROJECT_STATUSES = ["active", "paused", "done"];
export const PROJECT_COLORS = ["#5b9bff", "#4fd88a", "#FFC629", "#f0883e", "#b98bff", "#ff7d7d"];
export const PROJECT_ICONS = ["◈", "🏥", "🎰", "📣", "📱", "💊", "🛒", "🎮", "💰", "📊", "🚀", "🎨", "🏦", "🍔", "🏠", "⚽"];
export const CALL_SERVICES = ["zoom", "googlemeet", "loom", "phone"];

const now = () => new Date().toISOString();

const parseDay = (value, label) => {
  if (value === null || value === "" || value === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new HttpError(400, `Некорректная дата: ${label}`);
  return String(value);
};

const validUser = (id) => {
  if (id === null || id === undefined || id === "") return null;
  const u = users.get(id);
  if (!u || u.disabled) throw new HttpError(400, "Сотрудник не найден");
  return u.id;
};

const validUsers = (list) =>
  Array.isArray(list) ? [...new Set(list.map(Number))].filter((id) => users.get(id) && !users.get(id).disabled).slice(0, 50) : [];

const validUrl = (value) => {
  const url = clean(value, 500);
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) throw new HttpError(400, "Ссылка должна начинаться с https://");
  return url;
};

export const publicProject = (p) => ({
  id: p.id,
  name: p.name,
  client: p.client || "",
  pmId: p.pmId ?? null,
  buyers: p.buyers || [],
  members: p.members || [],
  hasChat: p.hasChat !== false,
  hasFolder: p.hasFolder !== false,
  startAt: p.startAt || null,
  endAt: p.endAt || null,
  status: p.status || "active",
  color: p.color || PROJECT_COLORS[0],
  icon: p.icon || PROJECT_ICONS[0],
  calls: (p.calls || []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.date < b.date ? 1 : -1)),
  files: filesOf("project", p.id),
  createdBy: p.createdBy || null,
  createdAt: p.createdAt,
});

export const activeProjects = () => projects.filter((p) => !p.deleted).map(publicProject);

function getProject(id) {
  const p = projects.get(id);
  if (!p || p.deleted) throw new HttpError(404, "Проект не найден");
  return p;
}

/** Хто може змінювати проект: адміністратор, PM, автор */
export const canManageProject = (p, user) => can(user, "manage") || p.pmId === user.id || p.createdBy?.userId === user.id;

function fields(body, partial) {
  const out = {};
  if (!partial || "name" in body) {
    out.name = clean(body.name, 120);
    if (!out.name) throw new HttpError(400, "Укажите название проекта");
  }
  if ("client" in body) out.client = clean(body.client, 120);
  if ("pmId" in body) out.pmId = validUser(body.pmId);
  if ("buyers" in body) out.buyers = validUsers(body.buyers);
  if ("members" in body) out.members = validUsers(body.members);
  if ("hasChat" in body) out.hasChat = Boolean(body.hasChat);
  if ("hasFolder" in body) out.hasFolder = Boolean(body.hasFolder);
  if ("startAt" in body) out.startAt = parseDay(body.startAt, "старт");
  if ("endAt" in body) out.endAt = parseDay(body.endAt, "завершение");
  if ("status" in body && PROJECT_STATUSES.includes(body.status)) out.status = body.status;
  if ("color" in body && PROJECT_COLORS.includes(body.color)) out.color = body.color;
  if ("icon" in body && PROJECT_ICONS.includes(body.icon)) out.icon = body.icon;
  return out;
}

export function createProject(body, user) {
  const data = fields(body, false);
  if (data.startAt && data.endAt && data.endAt < data.startAt) throw new HttpError(400, "Завершение раньше старта");
  const p = projects.insert({
    status: "active",
    color: PROJECT_COLORS[0],
    icon: PROJECT_ICONS[0],
    hasChat: true,
    hasFolder: true,
    pmId: user.id,
    buyers: [],
    members: [],
    ...data,
    calls: [],
    createdBy: { userId: user.id, name: user.name },
    createdAt: now(),
  });
  return publicProject(p);
}

export function updateProject(id, body, user) {
  const p = getProject(id);
  if (!canManageProject(p, user)) throw new HttpError(403, "Изменять проект может PM, автор или администратор");
  const data = fields(body, true);
  const start = data.startAt !== undefined ? data.startAt : p.startAt;
  const end = data.endAt !== undefined ? data.endAt : p.endAt;
  if (start && end && end < start) throw new HttpError(400, "Завершение раньше старта");
  return publicProject(
    projects.update(p.id, (x) => {
      Object.assign(x, data);
      x.updatedAt = now();
    }),
  );
}

export function deleteProject(id, user) {
  const p = getProject(id);
  if (!can(user, "manage") && p.createdBy?.userId !== user.id) throw new HttpError(403, "Удалить может автор проекта или администратор");
  projects.update(p.id, (x) => {
    x.deleted = true;
    x.deletedAt = now();
  });
  removeFilesOf("project", p.id);
}

// ---------- созвони ----------
function callFields(body, partial) {
  const out = {};
  if (!partial || "title" in body) {
    out.title = clean(body.title, 160);
    if (!out.title) throw new HttpError(400, "Укажите тему созвона");
  }
  if (!partial || "date" in body) out.date = parseDay(body.date, "дата созвона") || new Date().toISOString().slice(0, 10);
  if ("service" in body) out.service = CALL_SERVICES.includes(body.service) ? body.service : "zoom";
  if ("duration" in body) out.duration = clean(body.duration, 40);
  if ("recording" in body) out.recording = validUrl(body.recording);
  if ("summary" in body) out.summary = clean(body.summary, 10000);
  if ("pinned" in body) out.pinned = Boolean(body.pinned);
  return out;
}

export function addCall(projectId, body, user) {
  const p = getProject(projectId);
  if (!canManageProject(p, user) && !(p.members || []).includes(user.id) && !(p.buyers || []).includes(user.id)) {
    throw new HttpError(403, "Добавлять созвоны может команда проекта");
  }
  const call = {
    id: crypto.randomBytes(6).toString("hex"),
    service: "zoom",
    duration: "",
    recording: "",
    summary: "",
    pinned: false,
    ...callFields(body, false),
    by: { userId: user.id, name: user.name },
    createdAt: now(),
  };
  return publicProject(
    projects.update(p.id, (x) => {
      x.calls = [...(x.calls || []), call].slice(-200);
    }),
  );
}

export function updateCall(projectId, callId, body, user) {
  const p = getProject(projectId);
  const call = (p.calls || []).find((c) => c.id === callId);
  if (!call) throw new HttpError(404, "Созвон не найден");
  if (!canManageProject(p, user) && call.by?.userId !== user.id && !(p.members || []).includes(user.id) && !(p.buyers || []).includes(user.id)) {
    throw new HttpError(403, "Нет доступа");
  }
  const data = callFields(body, true);
  return publicProject(
    projects.update(p.id, (x) => {
      const c = x.calls.find((item) => item.id === callId);
      Object.assign(c, data, { updatedAt: now() });
    }),
  );
}

export function deleteCall(projectId, callId, user) {
  const p = getProject(projectId);
  const call = (p.calls || []).find((c) => c.id === callId);
  if (!call) throw new HttpError(404, "Созвон не найден");
  if (!can(user, "manage") && call.by?.userId !== user.id) throw new HttpError(403, "Удалить может автор или администратор");
  return publicProject(
    projects.update(p.id, (x) => {
      x.calls = x.calls.filter((c) => c.id !== callId);
    }),
  );
}

export const projectExists = (id) => {
  const p = projects.get(id);
  return Boolean(p && !p.deleted);
};

export { getProject };
