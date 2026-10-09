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
const OWNER_TYPES = new Set(["task", "project"]);

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

export function sendFile(res, id) {
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
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Length": stat.size,
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(record.name)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  fs.createReadStream(file).pipe(res);
}
