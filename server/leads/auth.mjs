/**
 * Авторизація адмінки без сторонніх бібліотек:
 *  - паролі: scrypt + сіль (node:crypto);
 *  - 2FA: TOTP (RFC 6238) — Google Authenticator, 1Password, Authy…;
 *  - сесія: підписаний HMAC токен у cookie httpOnly + Secure + SameSite=Strict;
 *  - захист від перебору: ліміт невдалих спроб на IP та на email.
 */
import crypto from "node:crypto";
import fs from "node:fs";

import { REMEMBER_DAYS, SESSION_HOURS, TOTP_ISSUER } from "./config.mjs";
import { createCollection, dataPath } from "./store.mjs";

export const users = createCollection("users.json");
export const ROLES = ["admin", "manager"];

// ---------- секрет для підпису токенів ----------
function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = dataPath("secret.key");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const secret = crypto.randomBytes(48).toString("base64url");
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}
const SECRET = loadSecret();

const b64url = (buffer) => Buffer.from(buffer).toString("base64url");
const hmac = (value) => crypto.createHmac("sha256", SECRET).update(value).digest();

const safeEqual = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// ---------- паролі ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

const scrypt = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${b64url(salt)}$${b64url(key)}`;
}

const DUMMY_HASH = `scrypt$${b64url(Buffer.alloc(16))}$${b64url(Buffer.alloc(64))}`;

export async function verifyPassword(password, stored) {
  const [scheme, salt, key] = String(stored || DUMMY_HASH).split("$");
  if (scheme !== "scrypt") return false;
  const derived = await scrypt(String(password), Buffer.from(salt, "base64url"));
  return crypto.timingSafeEqual(derived, Buffer.from(key, "base64url"));
}

/** Оцінка надійності: як у макеті (довжина, регістр, цифри, символи) — 0…4 */
export function passwordScore(password) {
  const p = String(password || "");
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-ZА-ЯІЇЄҐ]/.test(p) && /[a-zа-яіїєґ]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-zА-Яа-яІЇЄҐіїєґ0-9]/.test(p)) score++;
  return score;
}

export function passwordProblem(password) {
  const p = String(password || "");
  if (p.length < 10) return "Минимум 10 символов";
  if (p.length > 200) return "Слишком длинный пароль";
  if (passwordScore(p) < 3) return "Пароль слишком простой — добавьте цифры, заглавные буквы или символы";
  return null;
}

export function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let core = "";
  const bytes = crypto.randomBytes(12);
  for (const byte of bytes) core += alphabet[byte % alphabet.length];
  // гарантуємо цифру, заглавну, малу й символ
  return `${core.slice(0, 4)}-${core.slice(4, 8)}-${core.slice(8)}K7m`;
}

// ---------- TOTP (2FA) ----------
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Encode = (buffer) => {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
};

const base32Decode = (text) => {
  let bits = "";
  for (const char of String(text).replace(/=+$/, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

const STEP = 30;

function hotp(secret, counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

export const totpNow = (secret, at = Date.now()) => hotp(secret, Math.floor(at / 1000 / STEP));

export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const otpauthUrl = (secret, email) =>
  `otpauth://totp/${encodeURIComponent(`${TOTP_ISSUER}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(TOTP_ISSUER)}&algorithm=SHA1&digits=6&period=${STEP}`;

/**
 * Перевірка коду з допуском ±1 крок (30 с).
 * Повертає крок, якщо код вірний і ще не використовувався (захист від повтору).
 */
export function verifyTotp(secret, code, lastStep = -1) {
  const clean = String(code || "").replace(/\D/g, "");
  if (!secret || clean.length !== 6) return null;
  const current = Math.floor(Date.now() / 1000 / STEP);
  for (const step of [current - 1, current, current + 1]) {
    if (step <= lastStep) continue;
    if (safeEqual(hotp(secret, step), clean)) return step;
  }
  return null;
}

// ---------- токени (сесія і проміжні кроки входу) ----------
export function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(hmac(body))}`;
}

export function readToken(token, kind) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return null;
  if (!safeEqual(b64url(hmac(body)), signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.kind !== kind || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = "pl_admin";

export function createSession(user, remember) {
  const ttl = remember ? REMEMBER_DAYS * 86400_000 : SESSION_HOURS * 3600_000;
  const sid = crypto.randomBytes(9).toString("base64url");
  const token = signToken({ kind: "session", uid: user.id, v: user.tokenVersion || 0, sid, exp: Date.now() + ttl });
  return { token, maxAge: remember ? Math.floor(ttl / 1000) : null };
}

export function sessionFromToken(token) {
  const payload = readToken(token, "session");
  if (!payload) return null;
  const user = users.get(payload.uid);
  if (!user || user.disabled || (user.tokenVersion || 0) !== payload.v) return null;
  if ((user.revokedSessions || []).some((r) => r.sid === payload.sid)) return null;
  return { user, payload };
}

export const userFromSession = (token) => sessionFromToken(token)?.user || null;

/** Вихід: саме цей токен більше не діє (навіть якщо його скопіювали) */
export function revokeSession(token) {
  const session = sessionFromToken(token);
  if (!session) return;
  const { user, payload } = session;
  users.update(user.id, (u) => {
    const now = Date.now();
    u.revokedSessions = [...(u.revokedSessions || []).filter((r) => r.exp > now), { sid: payload.sid, exp: payload.exp }].slice(-200);
  });
}

/** Проміжний «квиток» між кроками входу (пароль → зміна пароля → 2FA), 10 хвилин */
export const createTicket = (user, remember, stage) =>
  signToken({ kind: "ticket", uid: user.id, v: user.tokenVersion || 0, remember: Boolean(remember), stage, exp: Date.now() + 600_000 });

export function userFromTicket(ticket, stage) {
  const payload = readToken(ticket, "ticket");
  if (!payload || payload.stage !== stage) return null;
  const user = users.get(payload.uid);
  if (!user || user.disabled || (user.tokenVersion || 0) !== payload.v) return null;
  return { user, remember: payload.remember };
}

// ---------- захист від перебору ----------
/**
 * Спроба рахується ДО перевірки пароля/коду (а не після) — тож паралельні запити
 * не обходять ліміт. Успішна спроба потім «повертається».
 *  - IP: 30 спроб / 15 хв;
 *  - акаунт з однієї IP: 6 / 15 хв (чужа IP не може заблокувати вам вхід);
 *  - акаунт загалом: 60 / 15 хв (стеля для розподіленого перебору).
 */
const WINDOW = 15 * 60_000;
const LIMITS = { ip: 30, accountIp: 6, account: 60 };
const attempts = new Map();

const recent = (key) => (attempts.get(key) || []).filter((time) => Date.now() - time < WINDOW);

const keysFor = (ip, account) => [
  [`ip:${ip}`, LIMITS.ip],
  ...(account ? [[`acc:${account}|${ip}`, LIMITS.accountIp], [`acc:${account}`, LIMITS.account]] : []),
];

/** Реєструє спробу; повертає false, якщо ліміт вичерпано (спроба тоді не рахується) */
export function beginAttempt(ip, account) {
  const keys = keysFor(ip, account);
  if (keys.some(([key, limit]) => recent(key).length >= limit)) return false;
  for (const [key] of keys) attempts.set(key, [...recent(key), Date.now()]);
  return true;
}

/** Успішна спроба не має з'їдати ліміт */
export function forgiveAttempt(ip, account) {
  for (const [key] of keysFor(ip, account)) {
    const list = recent(key);
    list.pop();
    if (list.length) attempts.set(key, list);
    else attempts.delete(key);
  }
}

setInterval(() => {
  for (const key of attempts.keys()) if (!recent(key).length) attempts.delete(key);
}, WINDOW).unref();

// ---------- користувачі ----------
export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const findUserByEmail = (email) => users.find((u) => u.email === normalizeEmail(email));

export const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  disabled: Boolean(user.disabled),
  totpEnabled: Boolean(user.totpEnabled),
  mustChangePassword: Boolean(user.mustChangePassword),
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null,
  telegram: Boolean(user.telegramChatId),
});

export async function createUser({ email, name, role = "manager", password }) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw Object.assign(new Error("Некорректный email"), { status: 400 });
  if (findUserByEmail(normalized)) throw Object.assign(new Error("Пользователь с таким email уже есть"), { status: 409 });
  if (!ROLES.includes(role)) throw Object.assign(new Error("Неизвестная роль"), { status: 400 });

  const tempPassword = password || generatePassword();
  const user = users.insert({
    email: normalized,
    name: String(name || normalized.split("@")[0]).trim().slice(0, 80),
    role,
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: !password,
    totpEnabled: false,
    totpSecret: null,
    totpPending: null,
    totpLastStep: -1,
    disabled: false,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
  });
  return { user, tempPassword };
}
