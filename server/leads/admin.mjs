/**
 * API адмінки: /api/admin/*
 *
 * Захист:
 *  - кожен запит має заголовок X-Requested-With: pika-admin (браузер не надішле його
 *    з чужого сайту без CORS-дозволу — захист від CSRF разом із SameSite=Strict);
 *  - сесія лише в httpOnly-cookie, недоступна JavaScript.
 */
import { REQUIRE_2FA } from "./config.mjs";
import {
  COOKIE_NAME,
  ROLES,
  beginAttempt,
  createSession,
  createTicket,
  createUser,
  findUserByEmail,
  generatePassword,
  forgiveAttempt,
  hashPassword,
  newTotpSecret,
  normalizeEmail,
  otpauthUrl,
  passwordProblem,
  publicUser,
  revokeSession,
  userFromSession,
  userFromTicket,
  users,
  verifyPassword,
  verifyTotp,
} from "./auth.mjs";
import { HttpError, clientIp, cookieHeader, parseCookies, readBody, send } from "./http.mjs";
import { addComment, createLead, deleteLead, leads, publicLead, setAmount, setManager, setStatus } from "./leads.mjs";
import { saveTracking, trackingInfo } from "./tracking.mjs";
import { activeTasks, createTask, deleteTask, publicTask, telegramLink, telegramUnlink, updateTask } from "./tasks.mjs";
import { LEAD_TYPES, STATUSES, isStatus } from "./statuses.mjs";
import { clean } from "./telegram.mjs";
import { requestReset, resetAvailable, resetPassword } from "./reset.mjs";
import {
  contentStatus,
  deleteContent,
  getContent,
  listContent,
  nextNumbers,
  readImage,
  reorderContent,
  saveContent,
  getSeo,
  saveSeoPage,
  seoAudit,
} from "./content.mjs";

const routes = [];
const route = (method, pattern, options, handler) =>
  routes.push({ method, pattern: new RegExp(`^/api/admin${pattern}$`), ...options, handler });

const maskEmail = (email) => {
  const [name, domain] = email.split("@");
  return `${name.length <= 2 ? `${name[0]}•` : `${name.slice(0, 2)}•••`}@${domain}`;
};

const TOO_MANY = "Слишком много попыток. Попробуйте через 15 минут";

/** Рахує спробу до перевірки (паралельні запити не обходять ліміт) */
const guard = (ip, account) => {
  if (!beginAttempt(ip, account)) throw new HttpError(429, TOO_MANY);
};

const sessionCookie = (user, remember) => {
  const { token, maxAge } = createSession(user, remember);
  return cookieHeader(COOKIE_NAME, token, { maxAge });
};

/** Наступний крок входу після перевірки пароля */
function nextStep(res, user, remember) {
  if (user.mustChangePassword) {
    return send(res, 200, { status: "change-password", ticket: createTicket(user, remember, "password") });
  }
  if (user.totpEnabled) {
    return send(res, 200, { status: "2fa", ticket: createTicket(user, remember, "2fa"), email: maskEmail(user.email) });
  }
  if (REQUIRE_2FA) {
    const secret = newTotpSecret();
    users.update(user.id, (u) => {
      u.totpPending = secret;
    });
    return send(res, 200, {
      status: "setup-2fa",
      ticket: createTicket(user, remember, "setup"),
      secret,
      otpauth: otpauthUrl(secret, user.email),
    });
  }
  return finishLogin(res, user, remember);
}

function finishLogin(res, user, remember) {
  users.update(user.id, (u) => {
    u.lastLoginAt = new Date().toISOString();
  });
  return send(res, 200, { status: "ok", user: publicUser(user) }, { "Set-Cookie": sessionCookie(user, remember) });
}

// ---------- вхід ----------
route("POST", "/auth/login", { public: true }, async ({ req, res, body }) => {
  const ip = clientIp(req);
  const email = normalizeEmail(body.email).slice(0, 200);
  guard(ip, email);

  const user = findUserByEmail(email);
  // пароль перевіряємо завжди — однаковий час відповіді, чи існує email, чи ні
  const valid = await verifyPassword(String(body.password || "").slice(0, 200), user?.passwordHash);
  if (!user || !valid || user.disabled) throw new HttpError(401, "Неверный email или пароль");
  forgiveAttempt(ip, email);
  return nextStep(res, user, body.remember);
});

// ---------- відновлення пароля через email ----------
route("GET", "/auth/forgot", { public: true }, ({ res }) => send(res, 200, { available: resetAvailable() }));

route("POST", "/auth/forgot", { public: true }, ({ req, res, body }) => {
  requestReset(body.email, clientIp(req));
  return send(res, 200, { ok: true });
});

route("POST", "/auth/reset", { public: true }, async ({ req, res, body }) => {
  await resetPassword(body.token, body.password, clientIp(req));
  return send(res, 200, { ok: true });
});

route("POST", "/auth/change-password", { public: true }, async ({ res, body }) => {
  const found = userFromTicket(body.ticket, "password");
  if (!found) throw new HttpError(401, "Сессия входа истекла — войдите заново");
  const problem = passwordProblem(body.password);
  if (problem) throw new HttpError(400, problem);
  if (await verifyPassword(body.password, found.user.passwordHash)) {
    throw new HttpError(400, "Новый пароль должен отличаться от временного");
  }
  const passwordHash = await hashPassword(body.password);
  const user = users.update(found.user.id, (u) => {
    u.passwordHash = passwordHash;
    u.mustChangePassword = false;
    u.tokenVersion = (u.tokenVersion || 0) + 1;
  });
  return nextStep(res, user, found.remember);
});

route("POST", "/auth/2fa", { public: true }, async ({ req, res, body }) => {
  const found = userFromTicket(body.ticket, "2fa");
  if (!found) throw new HttpError(401, "Сессия входа истекла — войдите заново");
  const ip = clientIp(req);
  const account = found.user.email;
  guard(ip, account);

  const step = verifyTotp(found.user.totpSecret, body.code, found.user.totpLastStep ?? -1);
  if (step === null) throw new HttpError(401, "Неверный код");
  forgiveAttempt(ip, account);
  const user = users.update(found.user.id, (u) => {
    u.totpLastStep = step;
  });
  return finishLogin(res, user, found.remember);
});

route("POST", "/auth/2fa-setup", { public: true }, async ({ req, res, body }) => {
  const found = userFromTicket(body.ticket, "setup");
  if (!found || !found.user.totpPending) throw new HttpError(401, "Сессия входа истекла — войдите заново");
  const ip = clientIp(req);
  guard(ip, found.user.email);

  const step = verifyTotp(found.user.totpPending, body.code);
  if (step === null) throw new HttpError(401, "Неверный код — проверьте время на телефоне и попробуйте ещё раз");
  forgiveAttempt(ip, found.user.email);
  const user = users.update(found.user.id, (u) => {
    u.totpSecret = u.totpPending;
    u.totpPending = null;
    u.totpEnabled = true;
    u.totpLastStep = step;
  });
  return finishLogin(res, user, found.remember);
});

route("POST", "/auth/logout", { public: true }, ({ req, res }) => {
  // токен відкликається на сервері — навіть скопійована cookie більше не діє
  revokeSession(parseCookies(req)[COOKIE_NAME]);
  return send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(COOKIE_NAME, "", { clear: true }) });
});

route("GET", "/auth/me", {}, ({ res, user }) => send(res, 200, { user: publicUser(user), require2fa: REQUIRE_2FA }));

// ---------- профіль ----------
route("POST", "/me/password", {}, async ({ req, res, body, user }) => {
  const ip = clientIp(req);
  guard(ip, user.email);
  if (!(await verifyPassword(String(body.current || "").slice(0, 200), user.passwordHash))) {
    throw new HttpError(400, "Текущий пароль указан неверно");
  }
  forgiveAttempt(ip, user.email);
  const problem = passwordProblem(body.password);
  if (problem) throw new HttpError(400, problem);
  const passwordHash = await hashPassword(body.password);
  // нова версія токенів — інші пристрої буде розлогінено
  const updated = users.update(user.id, (u) => {
    u.passwordHash = passwordHash;
    u.tokenVersion = (u.tokenVersion || 0) + 1;
  });
  return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(updated, false) });
});

route("POST", "/me/2fa/setup", {}, ({ res, user }) => {
  if (user.totpEnabled) throw new HttpError(400, "2FA уже включена");
  const secret = newTotpSecret();
  users.update(user.id, (u) => {
    u.totpPending = secret;
  });
  return send(res, 200, { secret, otpauth: otpauthUrl(secret, user.email) });
});

route("POST", "/me/2fa/enable", {}, ({ req, res, user, body }) => {
  const ip = clientIp(req);
  guard(ip, user.email);
  const step = verifyTotp(user.totpPending, body.code);
  if (step === null) throw new HttpError(400, "Неверный код");
  forgiveAttempt(ip, user.email);
  const updated = users.update(user.id, (u) => {
    u.totpSecret = u.totpPending;
    u.totpPending = null;
    u.totpEnabled = true;
    u.totpLastStep = step;
  });
  return send(res, 200, { user: publicUser(updated) });
});

route("POST", "/me/2fa/disable", {}, async ({ req, res, user, body }) => {
  if (REQUIRE_2FA) throw new HttpError(403, "2FA обязательна для всех сотрудников");
  const ip = clientIp(req);
  guard(ip, user.email);
  const passwordOk = await verifyPassword(String(body.password || "").slice(0, 200), user.passwordHash);
  const step = verifyTotp(user.totpSecret, body.code, user.totpLastStep ?? -1);
  if (!passwordOk || step === null) throw new HttpError(400, "Неверный пароль или код");
  forgiveAttempt(ip, user.email);
  const updated = users.update(user.id, (u) => {
    u.totpEnabled = false;
    u.totpSecret = null;
    u.totpLastStep = step;
  });
  return send(res, 200, { user: publicUser(updated) });
});

// ---------- довідники ----------
route("GET", "/meta", {}, ({ res }) =>
  send(res, 200, {
    statuses: STATUSES.map(({ code, label, emoji, color, final }) => ({ code, label, emoji, color, final })),
    types: LEAD_TYPES,
    roles: ROLES,
  }),
);

// ---------- заявки ----------
const activeLeads = () =>
  leads
    .filter((lead) => !lead.deleted)
    .sort((a, b) => b.id - a.id)
    .map(publicLead);

const leadOr404 = (id) => {
  const lead = leads.get(id);
  if (!lead || lead.deleted) throw new HttpError(404, "Заявка не найдена");
  return lead;
};

const validManager = (managerId) => {
  if (managerId === null) return null;
  const manager = users.get(managerId);
  if (!manager || manager.disabled) throw new HttpError(400, "Сотрудник не найден");
  return manager.id;
};

route("GET", "/leads", {}, ({ res }) => send(res, 200, { leads: activeLeads() }));

route("GET", "/leads/(\\d+)", {}, ({ res, params }) => send(res, 200, { lead: publicLead(leadOr404(params[0])) }));

route("POST", "/leads", {}, async ({ res, body, user, req }) => {
  const data = {};
  for (const key of ["name", "phone_full", "email", "telegram", "niche", "message"]) {
    const value = clean(body[key], key === "message" ? 2000 : 200);
    if (value) data[key] = value;
  }
  if (!data.name && !data.phone_full && !data.email && !data.telegram) {
    throw new HttpError(400, "Укажите имя или контакт");
  }
  const lead = await createLead(
    { type: "manual", source: clean(body.source, 60) || "Вручную", data },
    { user, ip: clientIp(req) },
  );
  if (body.managerId) setManager(lead.id, validManager(Number(body.managerId)), { user });
  return send(res, 201, { lead: publicLead(leads.get(lead.id)) });
});

route("PATCH", "/leads/(\\d+)", {}, async ({ res, body, user, params }) => {
  const lead = leadOr404(params[0]);
  if ("managerId" in body) setManager(lead.id, validManager(body.managerId === null ? null : Number(body.managerId)), { user });
  if ("amount" in body) setAmount(lead.id, body.amount, { user });
  if ("status" in body) {
    if (!isStatus(body.status)) throw new HttpError(400, "Неизвестный статус");
    await setStatus(lead.id, body.status, { user });
  }
  return send(res, 200, { lead: publicLead(leads.get(lead.id)) });
});

route("POST", "/leads/bulk", {}, async ({ res, body, user }) => {
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).slice(0, 500) : [];
  if (!ids.length) throw new HttpError(400, "Не выбраны заявки");
  if (body.status !== undefined && !isStatus(body.status)) throw new HttpError(400, "Неизвестный статус");
  const managerId = "managerId" in body ? validManager(body.managerId === null ? null : Number(body.managerId)) : undefined;

  for (const id of ids) {
    const lead = leads.get(id);
    if (!lead || lead.deleted) continue;
    if (managerId !== undefined) setManager(id, managerId, { user });
    if (body.status) await setStatus(id, body.status, { user });
  }
  return send(res, 200, { leads: activeLeads() });
});

route("POST", "/leads/(\\d+)/comments", {}, ({ res, body, user, params }) => {
  const text = clean(body.text, 4000);
  if (!text) throw new HttpError(400, "Пустой комментарий");
  leadOr404(params[0]);
  const lead = addComment(Number(params[0]), text, { user });
  return send(res, 201, { lead: publicLead(lead) });
});

route("DELETE", "/leads/(\\d+)", { admin: true }, ({ res, user, params }) => {
  leadOr404(params[0]);
  deleteLead(Number(params[0]), { user });
  return send(res, 200, { ok: true });
});

// ---------- команда ----------
route("GET", "/users", {}, ({ res, user }) => {
  const list = users.all().filter((u) => user.role === "admin" || !u.disabled);
  return send(res, 200, {
    users: list.map((u) => (user.role === "admin" ? publicUser(u) : { id: u.id, name: u.name, role: u.role })),
  });
});

route("POST", "/users", { admin: true }, async ({ res, body }) => {
  const { user, tempPassword } = await createUser({
    email: body.email,
    name: clean(body.name, 80),
    role: body.role,
  });
  return send(res, 201, { user: publicUser(user), tempPassword });
});

const activeAdmins = () => users.filter((u) => u.role === "admin" && !u.disabled);

route("PATCH", "/users/(\\d+)", { admin: true }, ({ res, body, user, params }) => {
  const target = users.get(params[0]);
  if (!target) throw new HttpError(404, "Сотрудник не найден");

  if ("role" in body && !ROLES.includes(body.role)) throw new HttpError(400, "Неизвестная роль");
  const losesAdmin =
    target.role === "admin" && ((body.role && body.role !== "admin") || body.disabled === true);
  if (losesAdmin && activeAdmins().length <= 1) throw new HttpError(400, "Нельзя убрать последнего администратора");
  if (target.id === user.id && body.disabled === true) throw new HttpError(400, "Нельзя заблокировать себя");

  const updated = users.update(target.id, (u) => {
    if (typeof body.name === "string" && body.name.trim()) u.name = clean(body.name, 80);
    if (body.role) u.role = body.role;
    if (typeof body.disabled === "boolean") {
      u.disabled = body.disabled;
      if (body.disabled) u.tokenVersion = (u.tokenVersion || 0) + 1;
    }
  });
  return send(res, 200, { user: publicUser(updated) });
});

route("POST", "/users/(\\d+)/reset-password", { admin: true }, async ({ res, params }) => {
  const target = users.get(params[0]);
  if (!target) throw new HttpError(404, "Сотрудник не найден");
  const tempPassword = generatePassword();
  const passwordHash = await hashPassword(tempPassword);
  const updated = users.update(target.id, (u) => {
    u.passwordHash = passwordHash;
    u.mustChangePassword = true;
    u.tokenVersion = (u.tokenVersion || 0) + 1;
  });
  return send(res, 200, { user: publicUser(updated), tempPassword });
});

route("POST", "/users/(\\d+)/reset-2fa", { admin: true }, ({ res, params }) => {
  const target = users.get(params[0]);
  if (!target) throw new HttpError(404, "Сотрудник не найден");
  const updated = users.update(target.id, (u) => {
    u.totpEnabled = false;
    u.totpSecret = null;
    u.totpPending = null;
    u.tokenVersion = (u.tokenVersion || 0) + 1;
  });
  return send(res, 200, { user: publicUser(updated) });
});

// ---------- контент сайту (кейси, блог, відгуки) — лише адміністратор ----------
const COLLECTION = "(cases|articles|reviews)";
const ITEM_ID = "([a-z0-9-]{1,80})";

route("GET", "/content/status", { admin: true }, async ({ res }) => send(res, 200, await contentStatus()));

// картинка з репозиторію для <img> (браузер не додає X-Requested-With; cookie SameSite=Strict)
route("GET", "/content/image", { admin: true, image: true }, async ({ req, res, query }) => {
  const { buffer, type, etag } = await readImage(String(query.get("path") || ""));
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ETag: etag });
    return res.end();
  }
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": buffer.length,
    "Cache-Control": "private, max-age=3600",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  res.end(buffer);
});

route("GET", "/content/seo", { admin: true }, async ({ res }) => send(res, 200, await getSeo()));

route("PUT", "/content/seo", { admin: true }, async ({ res, body, user }) => send(res, 200, await saveSeoPage(body, user)));

route("GET", "/content/seo/audit", { admin: true }, async ({ res, query }) =>
  send(res, 200, await seoAudit({ refresh: query.get("refresh") === "1" })),
);

route("GET", `/content/${COLLECTION}`, { admin: true }, async ({ res, params }) =>
  send(res, 200, await listContent(params[0])),
);

route("GET", `/content/${COLLECTION}/new`, { admin: true }, async ({ res, params }) =>
  send(res, 200, { next: await nextNumbers(params[0]) }),
);

route("POST", `/content/${COLLECTION}/order`, { admin: true }, async ({ res, params, body, user }) =>
  send(res, 200, { commit: await reorderContent(params[0], body.ids, user) }),
);

route("GET", `/content/${COLLECTION}/${ITEM_ID}`, { admin: true }, async ({ res, params }) =>
  send(res, 200, await getContent(params[0], params[1])),
);

route("PUT", `/content/${COLLECTION}/${ITEM_ID}`, { admin: true, bodyLimit: 40 * 1024 * 1024 }, async ({ res, params, body, user }) =>
  send(res, 200, await saveContent(params[0], params[1], body, user)),
);

route("DELETE", `/content/${COLLECTION}/${ITEM_ID}`, { admin: true }, async ({ res, params, query, user }) =>
  send(res, 200, { commit: await deleteContent(params[0], params[1], query.get("sha"), user) }),
);

// ---------- задачі ----------
route("GET", "/tasks", {}, ({ res }) => send(res, 200, { tasks: activeTasks() }));

route("POST", "/tasks", {}, ({ res, body, user }) => send(res, 201, { task: publicTask(createTask(body, user)) }));

route("PATCH", "/tasks/(\\d+)", {}, ({ res, body, user, params }) => send(res, 200, { task: publicTask(updateTask(Number(params[0]), body, user)) }));

route("DELETE", "/tasks/(\\d+)", {}, ({ res, user, params }) => {
  deleteTask(Number(params[0]), user);
  return send(res, 200, { ok: true });
});

// Telegram для нагадувань: посилання на бота з одноразовим кодом
route("POST", "/me/telegram", {}, async ({ res, user }) => send(res, 200, await telegramLink(user)));

route("DELETE", "/me/telegram", {}, ({ res, user }) => {
  telegramUnlink(user);
  return send(res, 200, { user: publicUser(users.get(user.id)) });
});

// ---------- інтеграції: Meta Conversions API, GA4 Measurement Protocol ----------
const CURRENCIES = ["USD", "EUR", "UAH", "PLN"];

route("GET", "/integrations", { admin: true }, ({ res }) => send(res, 200, trackingInfo()));

route("PUT", "/integrations", { admin: true }, ({ res, body }) => {
  const rules = {};
  for (const status of STATUSES) {
    if (status.code === "new") continue;
    const rule = body.rules?.[status.code] || {};
    const meta = String(rule.meta || "").trim();
    const ga4 = String(rule.ga4 || "").trim();
    if (meta && !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(meta)) throw new HttpError(400, `Событие Meta «${meta}»: только латиница, цифры и _`);
    if (ga4 && !/^[a-z][a-z0-9_]{0,39}$/.test(ga4)) throw new HttpError(400, `Событие GA4 «${ga4}»: маленькие латинские буквы, цифры и _`);
    rules[status.code] = { meta, ga4 };
  }
  const testEventCode = String(body.testEventCode || "").trim();
  if (testEventCode && !/^[A-Za-z0-9]{1,30}$/.test(testEventCode)) throw new HttpError(400, "Некорректный тестовый код событий");
  saveTracking({
    currency: CURRENCIES.includes(body.currency) ? body.currency : "USD",
    requireConsent: body.requireConsent !== false,
    testEventCode,
    rules,
  });
  return send(res, 200, trackingInfo());
});

// ---------- обробник ----------
export async function handleAdmin(req, res) {
  const url = new URL(req.url, "http://localhost");
  const match = routes
    .map((r) => ({ r, m: r.method === req.method && url.pathname.match(r.pattern) }))
    .find(({ m }) => m);

  // захист від CSRF; виняток — GET картинок для <img> (нічого не змінює)
  const isImage = match?.r.image && req.method === "GET";
  if (!isImage && req.headers["x-requested-with"] !== "pika-admin") {
    return send(res, 403, { error: "Forbidden" });
  }
  if (!match) return send(res, 404, { error: "Not found" });

  const { r, m } = match;
  try {
    let user = null;
    if (!r.public) {
      user = userFromSession(parseCookies(req)[COOKIE_NAME]);
      if (!user) return send(res, 401, { error: "Требуется вход" });
      if (r.admin && user.role !== "admin") return send(res, 403, { error: "Недостаточно прав" });
    }
    const body = ["POST", "PATCH", "PUT"].includes(req.method) ? await readBody(req, r.bodyLimit) : {};
    await r.handler({ req, res, body, user, params: m.slice(1), query: url.searchParams });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("[admin]", error);
    // HttpError — повідомлення для людини (напр. «GitHub: …»), інше — внутрішня помилка
    const message = error instanceof HttpError ? error.message : "Ошибка сервера";
    if (!res.headersSent) send(res, status, { error: message });
  }
}
