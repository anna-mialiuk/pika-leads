/**
 * Відновлення пароля через email.
 *  1) /auth/forgot { email } — лист із посиланням (діє 30 хв, одноразове).
 *     Відповідь завжди однакова: не видаємо, чи є такий email у системі.
 *  2) /auth/reset { token, password } — новий пароль; усі сесії користувача завершуються.
 * У базі зберігається лише хеш токена. 2FA після скидання пароля лишається обов'язковою.
 */
import crypto from "node:crypto";

import { ADMIN_URL } from "./config.mjs";
import { findUserByEmail, hashPassword, normalizeEmail, passwordProblem, users } from "./auth.mjs";
import { HttpError } from "./http.mjs";
import { mailConfigured, sendMail } from "./mail.mjs";

const RESET_MINUTES = 30;
const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

// окремі ліміти: IP — 5 запитів / 15 хв, адреса — 3 листи / годину
const hits = new Map();
const allow = (key, limit, windowMs) => {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) return false;
  list.push(now);
  hits.set(key, list);
  return true;
};
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) if (!list.some((t) => now - t < 60 * 60_000)) hits.delete(key);
}, 15 * 60_000).unref();

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function letter({ name, link }) {
  const text = [
    `Здравствуйте, ${name}!`,
    "",
    "Кто-то (надеемся, вы) запросил сброс пароля в панели Pikaleads.",
    `Чтобы задать новый пароль, откройте ссылку — она действует ${RESET_MINUTES} минут и только один раз:`,
    link,
    "",
    "Если вы не запрашивали сброс — просто проигнорируйте письмо, пароль не изменится.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#121110;padding:32px 16px;font-family:Arial,sans-serif;color:#f7f5ef">
<div style="max-width:480px;margin:0 auto;background:#1c1a17;border:1px solid #2c2a26;border-radius:16px;padding:28px">
<div style="font-weight:800;font-size:18px;margin-bottom:18px">PIKA<span style="color:#ffc629">LEADS</span></div>
<h1 style="font-size:20px;margin:0 0 12px">Сброс пароля</h1>
<p style="color:#cfcac0;line-height:1.5;margin:0 0 20px">Здравствуйте, ${escapeHtml(name)}! Кто-то (надеемся, вы) запросил сброс пароля в панели Pikaleads.</p>
<a href="${escapeHtml(link)}" style="display:inline-block;background:#ffc629;color:#121110;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:11px">Задать новый пароль</a>
<p style="color:#a29c8f;font-size:13px;line-height:1.5;margin:20px 0 0">Ссылка действует ${RESET_MINUTES} минут и только один раз. Если вы не запрашивали сброс — просто проигнорируйте письмо, пароль не изменится.</p>
</div></body></html>`;
  return { subject: "Сброс пароля — Pikaleads", text, html };
}

export const resetAvailable = () => mailConfigured();

export function requestReset(emailInput, ip) {
  if (!mailConfigured()) throw new HttpError(503, "Восстановление по почте не настроено — обратитесь к администратору");
  if (!allow(`ip:${ip}`, 5, 15 * 60_000)) throw new HttpError(429, "Слишком много запросов. Попробуйте через 15 минут");

  const email = normalizeEmail(emailInput).slice(0, 200);
  const user = findUserByEmail(email);
  if (!user || user.disabled || !allow(`acc:${email}`, 3, 60 * 60_000)) return;

  const token = crypto.randomBytes(32).toString("base64url");
  users.update(user.id, (u) => {
    u.resetHash = sha256(token);
    u.resetExpires = new Date(Date.now() + RESET_MINUTES * 60_000).toISOString();
    // пароль змінили іншим шляхом (адмін, профіль) — посилання перестає діяти
    u.resetVersion = u.tokenVersion || 0;
  });
  const link = `${ADMIN_URL}/login#reset=${token}`;
  // не чекаємо відправки: час відповіді не має видавати, чи існує адреса
  sendMail({ to: user.email, ...letter({ name: user.name, link }) }).catch((error) =>
    console.error(`[reset] лист для ${user.email} не отправлен:`, error.message),
  );
}

export async function resetPassword(token, password, ip) {
  if (!allow(`reset:${ip}`, 20, 15 * 60_000)) throw new HttpError(429, "Слишком много попыток. Попробуйте через 15 минут");
  const hash = sha256(String(token || "").slice(0, 200));
  const user = users.find((u) => u.resetHash && u.resetHash === hash);
  const stale = !user?.resetExpires || new Date(user.resetExpires) < new Date() || user.resetVersion !== (user.tokenVersion || 0);
  if (!user || user.disabled || stale) {
    throw new HttpError(400, "Ссылка устарела или уже использована. Запросите новую");
  }
  const problem = passwordProblem(password);
  if (problem) throw new HttpError(400, problem);

  const passwordHash = await hashPassword(password);
  users.update(user.id, (u) => {
    u.passwordHash = passwordHash;
    u.mustChangePassword = false;
    u.resetHash = null;
    u.resetExpires = null;
    u.resetVersion = null;
    u.tokenVersion = (u.tokenVersion || 0) + 1; // вихід з усіх пристроїв
  });

  sendMail({
    to: user.email,
    subject: "Пароль изменён — Pikaleads",
    text: `Здравствуйте, ${user.name}!\n\nПароль в панели Pikaleads только что изменён. Если это были не вы — срочно сообщите администратору.`,
    html: `<p>Здравствуйте, ${escapeHtml(user.name)}!</p><p>Пароль в панели Pikaleads только что изменён. Если это были не вы — срочно сообщите администратору.</p>`,
  }).catch(() => {});
}
