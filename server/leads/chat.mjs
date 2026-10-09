/**
 * Робочий чат команди (як Discord): текстові й голосові канали, канали проектів, приватні канали.
 * Канали — chat-channels.json, повідомлення кожного каналу — окремий файл chat-<id>.json
 * (щоб кожне нове повідомлення не переписувало всю історію чату).
 *
 * Голосовий канал — постійна кімната відеозв'язку (посилання з «Задачи → Настройки»).
 */
import { ADMIN_URL, BOT_TOKEN } from "./config.mjs";
import { users } from "./auth.mjs";
import { HttpError } from "./http.mjs";
import { activeProjects } from "./projects.mjs";
import { createCollection } from "./store.mjs";
import { escapeHtml, telegram } from "./telegram.mjs";
import { fileRecord, publicFile, inlineType } from "./files.mjs";

export const channels = createCollection("chat-channels.json");

const ICONS = ["#", "💬", "📣", "🎨", "📈", "💰", "🚀", "🧪", "📌", "🔊", "🎙", "◈", "🏥", "🎰", "📱", "🛒"];
const MAX_TEXT = 4000;
const SLOWMODE_MS = 30_000;
const now = () => new Date().toISOString();

// ---------- стартові канали ----------
if (!channels.existed && channels.size === 0) {
  channels.insertMany(
    [
      { name: "общий", topic: "Новости команды и всё подряд", icon: "#", type: "text" },
      { name: "байеры", topic: "Кабинеты, связки, баны", icon: "#", type: "text" },
      { name: "креативы", topic: "Крео на проверку и в тест", icon: "#", type: "text" },
      { name: "трафик", topic: "Цифры и результаты", icon: "#", type: "text" },
      { name: "Планёрка", topic: "Ежедневный созвон", icon: "🔊", type: "voice" },
    ].map((c) => ({ ...c, private: false, members: [], protect: {}, reads: {}, createdAt: now() })),
  );
}

// ---------- повідомлення: окрема колекція на канал ----------
const messageStores = new Map();
const messagesOf = (channelId) => {
  if (!messageStores.has(channelId)) messageStores.set(channelId, createCollection(`chat-${channelId}.json`));
  return messageStores.get(channelId);
};

// ---------- присутність (у пам'яті) ----------
const lastSeen = new Map(); // userId → ms
export const touch = (user) => lastSeen.set(user.id, Date.now());
const isOnline = (id) => Date.now() - (lastSeen.get(id) || 0) < 3 * 60_000;

// ---------- канали проектів (створюються автоматично) ----------
function syncProjectChannels() {
  const projects = activeProjects();
  for (const p of projects) {
    const existing = channels.find((c) => c.projectId === p.id);
    const want = p.hasChat !== false;
    if (!existing && want) {
      channels.insert({
        name: p.name.toLowerCase(),
        topic: `Чат проекта · ${p.name}`,
        icon: p.icon || "◈",
        type: "text",
        projectId: p.id,
        private: true,
        members: [],
        protect: {},
        reads: {},
        createdAt: now(),
      });
    } else if (existing && Boolean(existing.deleted) === want && !existing.deletedByAdmin) {
      channels.update(existing.id, (c) => {
        c.deleted = !want;
      });
    }
  }
  // проект видалили — ховаємо канал
  for (const c of channels.filter((x) => x.projectId && !x.deleted)) {
    if (!projects.some((p) => p.id === c.projectId)) channels.update(c.id, (x) => (x.deleted = true));
  }
}

function projectTeam(projectId) {
  const p = activeProjects().find((x) => x.id === projectId);
  if (!p) return [];
  return [p.pmId, p.createdBy?.userId, ...(p.buyers || []), ...(p.members || [])].filter(Boolean);
}

const isMember = (c, user) => {
  if (user.role === "admin") return true;
  if (c.projectId) return projectTeam(c.projectId).includes(user.id);
  if (!c.private) return true;
  return c.createdBy?.userId === user.id || (c.members || []).includes(user.id);
};

const isModerator = (c, user) =>
  user.role === "admin" || c.createdBy?.userId === user.id || (c.projectId && activeProjects().find((p) => p.id === c.projectId)?.pmId === user.id);

function getChannel(id, user) {
  const c = channels.get(id);
  if (!c || c.deleted) throw new HttpError(404, "Канал не найден");
  if (!isMember(c, user)) throw new HttpError(403, "Нет доступа к каналу");
  return c;
}

const publicChannel = (c, user) => {
  const store = messagesOf(c.id);
  const last = store.size ? store.all()[store.size - 1] : null;
  const lastRead = c.reads?.[user.id] || 0;
  const unread = store.filter((m) => !m.deleted && m.id > lastRead && m.userId !== user.id).length;
  return {
    id: c.id,
    name: c.name,
    topic: c.topic || "",
    icon: c.icon || (c.type === "voice" ? "🔊" : "#"),
    type: c.type,
    private: Boolean(c.private),
    projectId: c.projectId || null,
    members: c.members || [],
    protect: { onlyMods: false, noForward: false, slowmode: false, ...(c.protect || {}) },
    createdBy: c.createdBy || null,
    canModerate: isModerator(c, user),
    canWrite: !c.protect?.onlyMods || isModerator(c, user),
    unread: c.type === "voice" ? 0 : unread,
    lastId: last?.id || 0,
    deleteRequest: c.deleteRequest || null,
    voice: c.voice || [],
  };
};

const publicMessage = (m) => ({
  id: m.id,
  userId: m.userId,
  name: m.name,
  text: m.text,
  file: m.fileId ? (() => {
    const f = fileRecord(m.fileId);
    return f ? { ...publicFile(f), media: inlineType(f.name)?.split("/")[0] || null } : null;
  })() : null,
  fwd: m.fwd || null,
  reactions: m.reactions || {},
  pinned: Boolean(m.pinned),
  mentions: m.mentions || [],
  at: m.at,
  editedAt: m.editedAt || null,
});

// ---------- огляд чату ----------
export function chatOverview(user) {
  touch(user);
  syncProjectChannels();
  const list = channels.filter((c) => !c.deleted && isMember(c, user)).map((c) => publicChannel(c, user));
  const members = users
    .filter((u) => !u.disabled)
    .map((u) => ({ id: u.id, name: u.name, position: u.position || "", role: u.role, online: isOnline(u.id) || u.id === user.id }));
  return { channels: list, members, icons: ICONS };
}

// ---------- канали ----------
function channelFields(body, partial) {
  const out = {};
  if (!partial || "name" in body) {
    out.name = String(body.name ?? "")
      .trim()
      .replace(/^#+/, "")
      .slice(0, 40);
    if (!out.name) throw new HttpError(400, "Укажите название канала");
  }
  if ("topic" in body) out.topic = String(body.topic ?? "").trim().slice(0, 120);
  if ("icon" in body) out.icon = ICONS.includes(body.icon) ? body.icon : "#";
  if ("type" in body) out.type = body.type === "voice" ? "voice" : "text";
  if ("private" in body) out.private = Boolean(body.private);
  if ("members" in body) {
    out.members = Array.isArray(body.members)
      ? [...new Set(body.members.map(Number))].filter((id) => users.get(id) && !users.get(id).disabled).slice(0, 100)
      : [];
  }
  if (body.protect && typeof body.protect === "object") {
    out.protect = {
      onlyMods: Boolean(body.protect.onlyMods),
      noForward: Boolean(body.protect.noForward),
      slowmode: Boolean(body.protect.slowmode),
    };
  }
  return out;
}

export function createChannel(body, user) {
  const data = channelFields(body, false);
  const c = channels.insert({
    type: "text",
    icon: data.type === "voice" ? "🔊" : "#",
    topic: "",
    private: false,
    members: [],
    protect: {},
    reads: {},
    ...data,
    createdBy: { userId: user.id, name: user.name },
    createdAt: now(),
  });
  return publicChannel(c, user);
}

export function updateChannel(id, body, user) {
  const c = getChannel(id, user);
  if (!isModerator(c, user)) throw new HttpError(403, "Изменять канал может администратор или автор канала");
  const data = channelFields(body, true);
  if (c.projectId) {
    delete data.private; // доступ до каналу проекту — команда проекту
    delete data.members;
  }
  return publicChannel(
    channels.update(c.id, (x) => Object.assign(x, data, { updatedAt: now() })),
    user,
  );
}

export function deleteChannel(id, user) {
  const c = getChannel(id, user);
  if (user.role !== "admin") throw new HttpError(403, "Удалить канал может администратор — отправьте заявку");
  channels.update(c.id, (x) => {
    x.deleted = true;
    x.deletedByAdmin = true;
    x.deleteRequest = null;
  });
}

/** Заявка на видалення (не адміністратор) / скасувати / відхилити (адміністратор) */
export function requestDelete(id, user, cancel = false) {
  const c = getChannel(id, user);
  if (cancel) {
    if (user.role !== "admin" && c.deleteRequest?.userId !== user.id) throw new HttpError(403, "Нет доступа");
    return publicChannel(channels.update(c.id, (x) => (x.deleteRequest = null)), user);
  }
  return publicChannel(
    channels.update(c.id, (x) => {
      x.deleteRequest = { userId: user.id, name: user.name, at: now() };
    }),
    user,
  );
}

/** Голосовий канал: хто «в кімнаті» (натиснув «Войти») */
export function voicePresence(id, user, join) {
  const c = getChannel(id, user);
  if (c.type !== "voice") throw new HttpError(400, "Это не голосовой канал");
  return publicChannel(
    channels.update(c.id, (x) => {
      const fresh = (x.voice || []).filter((v) => v.userId !== user.id && Date.now() - Date.parse(v.at) < 3 * 3600_000);
      x.voice = join ? [...fresh, { userId: user.id, name: user.name, at: now() }] : fresh;
    }),
    user,
  );
}

// ---------- повідомлення ----------
export function listMessages(id, user, { after = 0, before = 0, since = "" } = {}) {
  touch(user);
  const c = getChannel(id, user);
  const store = messagesOf(c.id);
  let list = store.filter((m) => !m.deleted);
  if (after) list = list.filter((m) => m.id > after);
  if (before) list = list.filter((m) => m.id < before);
  const page = after ? list.slice(-200) : list.slice(-60);
  // прочитано
  const lastId = store.size ? store.all()[store.size - 1].id : 0;
  if ((c.reads?.[user.id] || 0) < lastId) {
    channels.update(c.id, (x) => {
      x.reads = { ...(x.reads || {}), [user.id]: lastId };
    });
  }
  // змінені після since (реакції, закріплення, видалення) — щоб у всіх оновилось
  const changed = since
    ? store.filter((m) => m.id <= after && m.changedAt && m.changedAt > since).map((m) => (m.deleted ? { id: m.id, deleted: true } : publicMessage(m)))
    : [];
  return {
    messages: page.map(publicMessage),
    changed,
    serverTime: now(),
    hasMore: !after && list.length > page.length,
    pinned: store.filter((m) => !m.deleted && m.pinned).map(publicMessage),
  };
}

const lastPost = new Map(); // `${channel}:${user}` → ms (повільний режим)

function notifyMentions(c, user, text, mentions) {
  if (!BOT_TOKEN) return;
  for (const uid of mentions) {
    if (uid === user.id) continue;
    const target = users.get(uid);
    if (!target?.telegramChatId || !isMember(c, target)) continue;
    telegram("sendMessage", {
      chat_id: target.telegramChatId,
      text: `💬 <b>${escapeHtml(user.name)}</b> в #${escapeHtml(c.name)}:\n${escapeHtml(text.slice(0, 1000))}\n<a href="${ADMIN_URL}/tasks/chat?channel=${c.id}">Открыть чат</a>`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }).catch((error) => console.error(`[chat] упоминание → ${uid}:`, error.message));
  }
}

export function postMessage(id, body, user) {
  touch(user);
  const c = getChannel(id, user);
  if (c.type === "voice") throw new HttpError(400, "В голосовой канал нельзя писать");
  if (c.protect?.onlyMods && !isModerator(c, user)) throw new HttpError(403, "В этом канале пишут только модераторы");
  const key = `${c.id}:${user.id}`;
  if (c.protect?.slowmode && !isModerator(c, user) && Date.now() - (lastPost.get(key) || 0) < SLOWMODE_MS) {
    throw new HttpError(429, "Медленный режим: одно сообщение в 30 секунд");
  }

  let text = String(body.text ?? "").slice(0, MAX_TEXT).trim();
  let fileId = null;
  let fwd = null;

  if (body.forward) {
    const from = getChannel(Number(body.forward.channelId), user);
    if (from.protect?.noForward) throw new HttpError(403, "В этом канале запрещена пересылка");
    const original = messagesOf(from.id).get(Number(body.forward.messageId));
    if (!original || original.deleted) throw new HttpError(404, "Сообщение не найдено");
    text = original.text;
    fileId = original.fileId || null;
    fwd = { name: original.name, channel: from.name };
  } else if (body.fileId) {
    const f = fileRecord(Number(body.fileId));
    if (!f || f.ownerType !== "chat" || f.ownerId !== c.id || f.by?.userId !== user.id) throw new HttpError(400, "Файл не найден");
    fileId = f.id;
  }
  if (!text && !fileId) throw new HttpError(400, "Пустое сообщение");

  const mentions = (Array.isArray(body.mentions) ? body.mentions : [])
    .map(Number)
    .filter((uid, i, arr) => arr.indexOf(uid) === i && users.get(uid) && text.includes(`@${users.get(uid).name}`))
    .slice(0, 20);

  const message = messagesOf(c.id).insert({
    userId: user.id,
    name: user.name,
    text,
    fileId,
    fwd,
    mentions,
    reactions: {},
    pinned: false,
    at: now(),
  });
  lastPost.set(key, Date.now());
  channels.update(c.id, (x) => {
    x.reads = { ...(x.reads || {}), [user.id]: message.id };
  });
  notifyMentions(c, user, text, mentions);
  return publicMessage(message);
}

function getMessage(c, messageId) {
  const m = messagesOf(c.id).get(messageId);
  if (!m || m.deleted) throw new HttpError(404, "Сообщение не найдено");
  return m;
}

export function reactMessage(id, messageId, emoji, user) {
  const c = getChannel(id, user);
  const m = getMessage(c, messageId);
  const value = String(emoji || "").slice(0, 8);
  if (!value || /[\w<>]/.test(value)) throw new HttpError(400, "Некорректная реакция");
  return publicMessage(
    messagesOf(c.id).update(m.id, (x) => {
      const r = { ...(x.reactions || {}) };
      const list = r[value] || [];
      r[value] = list.includes(user.id) ? list.filter((u) => u !== user.id) : [...list, user.id];
      if (!r[value].length) delete r[value];
      if (Object.keys(r).length > 20) throw new HttpError(400, "Слишком много реакций");
      x.reactions = r;
      x.changedAt = now();
    }),
  );
}

export function pinMessage(id, messageId, user) {
  const c = getChannel(id, user);
  const m = getMessage(c, messageId);
  if (c.protect?.onlyMods && !isModerator(c, user)) throw new HttpError(403, "Закреплять может модератор");
  return publicMessage(
    messagesOf(c.id).update(m.id, (x) => {
      x.pinned = !x.pinned;
      x.pinnedBy = x.pinned ? { userId: user.id, name: user.name } : null;
      x.changedAt = now();
    }),
  );
}

export function deleteMessage(id, messageId, user) {
  const c = getChannel(id, user);
  const m = getMessage(c, messageId);
  if (m.userId !== user.id && !isModerator(c, user)) throw new HttpError(403, "Удалить может автор или модератор");
  messagesOf(c.id).update(m.id, (x) => {
    x.deleted = true;
    x.deletedAt = now();
    x.changedAt = x.deletedAt;
  });
}

/** Перевірка доступу до файлу чату (для завантаження) */
export function canSeeChatFile(record, user) {
  if (record.ownerType !== "chat") return true;
  const c = channels.get(record.ownerId);
  return Boolean(c && !c.deleted && isMember(c, user));
}

export const chatChannelFor = (id, user) => getChannel(id, user);

