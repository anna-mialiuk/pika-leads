/**
 * Файли задач і проектів: зберігаються на сервері (DATA_DIR/files/<випадкове ім'я>),
 * опис — у files.json. Віддаються лише авторизованим, завжди як «завантажити» (не відкриваються в браузері).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DATA_DIR } from "./config.mjs";
import { HttpError } from "./http.mjs";
import { createCollection } from "./store.mjs";

export const files = createCollection("files.json");

const FILES_DIR = path.join(DATA_DIR, "files");
fs.mkdirSync(FILES_DIR, { recursive: true, mode: 0o700 });

export const MAX_FILE = 25 * 1024 * 1024;
const OWNER_TYPES = new Set(["task", "project", "library", "chat"]);

const cleanName = (raw) => {
  let name = "";
  try {
    name = decodeURIComponent(String(raw || ""));
  } catch {
    name = String(raw || "");
  }
  // без шляхів і керуючих символів
  name = name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 160);
  return name || "file";
};

export const publicFile = (f) => ({
  id: f.id,
  name: f.name,
  size: f.size,
  by: f.by?.name || "",
  byId: f.by?.userId ?? null,
  at: f.at,
});

export const filesOf = (ownerType, ownerId) =>
  files
    .filter((f) => !f.deleted && f.ownerType === ownerType && f.ownerId === Number(ownerId))
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map(publicFile);

/** Приймає тіло запиту як є (application/octet-stream), ім'я — у заголовку X-File-Name */
export function saveUpload(req, { ownerType, ownerId, user }) {
  if (!OWNER_TYPES.has(ownerType)) throw new HttpError(400, "Некорректный владелец файла");
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_FILE) throw new HttpError(413, "Файл больше 25 МБ");
  const name = cleanName(req.headers["x-file-name"]);
  const key = crypto.randomBytes(16).toString("hex");
  const target = path.join(FILES_DIR, key);

  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(target, { mode: 0o600 });
    let size = 0;
    let failed = false;
    const fail = (error) => {
      if (failed) return;
      failed = true;
      out.destroy();
      fs.rm(target, { force: true }, () => {});
      req.resume();
      reject(error);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_FILE) fail(new HttpError(413, "Файл больше 25 МБ"));
    });
    req.on("error", fail);
    out.on("error", (error) => fail(error));
    req.pipe(out);
    out.on("finish", () => {
      if (failed) return;
      if (!size) {
        fs.rm(target, { force: true }, () => {});
        return reject(new HttpError(400, "Пустой файл"));
      }
      const record = files.insert({
        key,
        name,
        size,
        ownerType,
        ownerId: Number(ownerId),
        by: { userId: user.id, name: user.name },
        at: new Date().toISOString(),
      });
      resolve(publicFile(record));
    });
  });
}

export function removeFile(id, user, canManageOwner) {
  const record = files.get(id);
  if (!record || record.deleted) throw new HttpError(404, "Файл не найден");
  if (user.role !== "admin" && record.by?.userId !== user.id && !canManageOwner?.(record)) {
    throw new HttpError(403, "Удалить может автор файла или администратор");
  }
  files.update(record.id, (f) => {
    f.deleted = true;
  });
  fs.rm(path.join(FILES_DIR, record.key), { force: true }, () => {});
  return record;
}

/** Видалити всі файли власника (задачу/проект видалили) */
export function removeFilesOf(ownerType, ownerId) {
  for (const f of files.filter((x) => !x.deleted && x.ownerType === ownerType && x.ownerId === Number(ownerId))) {
    files.update(f.id, (r) => {
      r.deleted = true;
    });
    fs.rm(path.join(FILES_DIR, f.key), { force: true }, () => {});
  }
}

// показ у браузері — лише безпечні типи медіа (без SVG/HTML)
const INLINE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
export const inlineType = (name) => INLINE_TYPES[String(name).split(".").pop().toLowerCase()] || null;

export const fileRecord = (id) => {
  const record = files.get(id);
  return record && !record.deleted ? record : null;
};

export function sendFile(res, id, { inline = false } = {}) {
  const record = files.get(id);
  if (!record || record.deleted) throw new HttpError(404, "Файл не найден");
  const file = path.join(FILES_DIR, record.key);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    throw new HttpError(404, "Файл не найден");
  }
  const ascii = record.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const type = inline ? inlineType(record.name) : null;
  res.writeHead(200, {
    "Content-Type": type || "application/octet-stream",
    "Content-Length": stat.size,
    "Content-Disposition": `${type ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(record.name)}`,
    "Cache-Control": type ? "private, max-age=86400" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  fs.createReadStream(file).pipe(res);
}

// ---------- посилання на Google Docs / Sheets / папки (розділ «Файлы») ----------
export const links = createCollection("links.json");
export const LINK_TYPES = ["doc", "sheet", "folder", "drive"];

export const publicLink = (l) => ({
  id: l.id,
  type: l.type,
  name: l.name,
  url: l.url,
  projectId: l.projectId ?? null,
  by: l.by?.name || "",
  byId: l.by?.userId ?? null,
  at: l.at,
});

export function createLink(body, user, projectExists) {
  const name = String(body.name ?? "").trim().slice(0, 160);
  const url = String(body.url ?? "").trim().slice(0, 1000);
  if (!name) throw new HttpError(400, "Укажите название");
  if (!/^https:\/\/[^\s"'<>]+$/i.test(url)) throw new HttpError(400, "Вставьте ссылку, начинающуюся с https://");
  const projectId = body.projectId ? Number(body.projectId) : null;
  if (projectId && !projectExists(projectId)) throw new HttpError(400, "Проект не найден");
  const record = links.insert({
    type: LINK_TYPES.includes(body.type) ? body.type : "drive",
    name,
    url,
    projectId,
    by: { userId: user.id, name: user.name },
    at: new Date().toISOString(),
  });
  return publicLink(record);
}

export function removeLink(id, user) {
  const record = links.get(id);
  if (!record || record.deleted) throw new HttpError(404, "Ссылка не найдена");
  if (user.role !== "admin" && record.by?.userId !== user.id) throw new HttpError(403, "Удалить может автор или администратор");
  links.update(record.id, (l) => {
    l.deleted = true;
  });
}

/** Усі файли для розділу «Файлы»: завантажені (задачі, проекти, бібліотека) + посилання */
export function allFiles({ taskById, projectExists }) {
  const uploaded = files
    .filter((f) => !f.deleted && f.ownerType !== "chat") // вкладення чату — лише в самому чаті
    .map((f) => {
      let projectId = null;
      let taskId = null;
      let taskTitle = "";
      if (f.ownerType === "project") projectId = f.ownerId;
      if (f.ownerType === "task") {
        const task = taskById(f.ownerId);
        if (!task || task.deleted) return null;
        taskId = task.id;
        taskTitle = task.title;
        projectId = task.projectId || null;
      }
      if (projectId && !projectExists(projectId)) {
        if (f.ownerType === "project") return null;
        projectId = null;
      }
      return { ...publicFile(f), kind: f.ownerType === "task" ? "attach" : "upload", projectId, taskId, taskTitle };
    })
    .filter(Boolean);
  const linked = links
    .filter((l) => !l.deleted)
    .map((l) => ({ ...publicLink(l), kind: "link", projectId: l.projectId && projectExists(l.projectId) ? l.projectId : null }));
  return [...uploaded, ...linked].sort((a, b) => (a.at < b.at ? 1 : -1));
}
