/**
 * Pika Leads — приймач заявок із сайту.
 *
 * POST /api/leads (JSON від src/services/leads.js)
 *   → перевірка й антиспам
 *   → запис у файл (резервна копія кожної заявки)
 *   → повідомлення в Telegram
 *
 * Без залежностей, Node 18+. Налаштування — змінні оточення (див. .env.example).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 3010);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const TELEGRAM_API = process.env.TELEGRAM_API_URL || "https://api.telegram.org";
const DATA_FILE = process.env.LEADS_FILE || path.resolve("leads.jsonl");
const MAX_BODY = 20 * 1024;

// ---------- антиспам: не більше N заявок з одного IP за вікно ----------
const RATE_LIMIT = 5;
const RATE_WINDOW = 10 * 60 * 1000;
const hits = new Map();

const isRateLimited = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(
    (time) => now - time < RATE_WINDOW,
  );
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
};

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    if (times.every((time) => now - time >= RATE_WINDOW)) hits.delete(ip);
  }
}, RATE_WINDOW).unref();

// ---------- форматування повідомлення (як у PIKALEADS || NOTIFY) ----------
const TYPE_LABELS = {
  consultation: "Консультация",
  audit: "Аудит рекламы",
  "service-audit": "Аудит (страница услуги)",
  question: "Вопрос со страницы контактов",
  bonus: "Колесо бонусов",
  callback: "Перезвонить",
  "chat-callback": "Звонок из чата",
  "chat-message": "Сообщение в чате",
};

const FIELD_LABELS = {
  name: "Имя",
  phone_full: "Телефон",
  email: "Email",
  telegram: "Telegram",
  messenger: "Telegram / WhatsApp",
  niche: "Ниша",
  business: "Направление бизнеса",
  platforms: "Реклама",
  message: "Сообщение",
  prize: "Приз",
};

// Кнопки статуса лида: [код, подпись]
const STATUSES = [
  ["call", "📞 Идём на звонок"],
  ["unqualified", "⛔ Не квалифицирован"],
  ["no_answer", "📵 Не дозвонились"],
  ["no_pickup", "📴 Не берёт трубку"],
  ["qualified", "✅ Квалифицирован"],
  ["scheduled", "📅 Запланирован звонок"],
  ["proposal", "📄 Скинуть КП"],
  ["sale", "💰 Продажа"],
  ["refused", "❌ Отказ"],
];
const STATUS_LABELS = Object.fromEntries(
  STATUSES.map(([code, label]) => [code, label.replace(/^\S+\s/, "")]),
);

const statusKeyboard = () => {
  const buttons = STATUSES.map(([code, label]) => ({
    text: label,
    callback_data: `st:${code}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2)
    rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
};

const STATUS_PREFIX = "<b>Статус лида:</b> ";
const WIDE_SPACER = "\u2800".repeat(48);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const clean = (value, max = 1000) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

function formatMessage(lead) {
  const data = lead.data || {};
  const a = lead.attribution || {};
  const lines = [
    "🔥 <b>Новая заявка с сайта</b>",
    `Форма: ${escapeHtml(TYPE_LABELS[lead.type] || lead.type)}`,
  ];

  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    let value = data[key];
    if (key === "phone_full" && !value) value = data.phone;
    if (Array.isArray(value)) value = value.join(", ");
    value = clean(value);
    if (!value) continue;

    if (key === "phone_full") {
      const digits = value.replace(/[^\d+]/g, "");
      lines.push(`${label}: <a href="tel:${digits}">${escapeHtml(value)}</a>`);
    } else if (
      (key === "telegram" || key === "messenger") &&
      /^@?\w{4,}$/.test(value)
    ) {
      const username = value.replace(/^@/, "");
      lines.push(
        `${label}: <a href="https://t.me/${username}">@${escapeHtml(username)}</a>`,
      );
    } else {
      lines.push(`${label}: ${escapeHtml(value)}`);
    }
  }

  const field = (label, value, max = 300) =>
    `${label}: ${escapeHtml(clean(value, max)) || "—"}`;

  lines.push(
    "",
    field("Страница", lead.page),
    field("Откуда (кнопка)", lead.source, 60),
    field("Язык", lead.lang, 10),
    // невидимий рядок (U+2800) розширює повідомлення — тоді кнопки статусу
    // показують повний текст, а не «Идё…звонок»
    WIDE_SPACER,
    field("Кампания", a.utm_campaign),
    field("Ключ", a.utm_content),
    field("Место размещения", a.placement || a.utm_term),
    field("Сорч (источник)", a.utm_source),
    field("Канал (medium)", a.utm_medium),
    `Campaign ID: ${escapeHtml(clean(a.campaign_id || a.utm_id, 60))}`,
    `Adset ID: ${escapeHtml(clean(a.adset_id, 60))}`,
    `Ad ID: ${escapeHtml(clean(a.ad_id, 60))}`,
    `fbclid: ${escapeHtml(clean(a.fbclid, 400))}`,
    `gclid: ${escapeHtml(clean(a.gclid, 400))}`,
    `ttclid: ${escapeHtml(clean(a.ttclid, 400))}`,
    field("Реферер", a.referrer),
    "",
    `${STATUS_PREFIX}Новый`,
  );

  return lines.join("\n");
}

// ---------- сообщения в Telegram: html каждого сообщения для смены статуса ----------
const MESSAGES_FILE =
  process.env.MESSAGES_FILE ||
  path.join(path.dirname(DATA_FILE), "messages.jsonl");
const messages = new Map();

try {
  for (const line of fs.readFileSync(MESSAGES_FILE, "utf8").split("\n")) {
    if (!line) continue;
    const { key, html } = JSON.parse(line);
    messages.set(key, html);
  }
} catch {
  /* файла ещё нет */
}

const rememberMessage = (chatId, messageId, html) => {
  const key = `${chatId}:${messageId}`;
  messages.set(key, html);
  try {
    fs.appendFileSync(MESSAGES_FILE, `${JSON.stringify({ key, html })}\n`);
  } catch (error) {
    console.error("[leads] не удалось сохранить сообщение:", error.message);
  }
};

const telegram = async (method, payload) => {
  const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    const error = new Error(
      `Telegram ${method} ${response.status}: ${body.description || ""}`,
    );
    error.code = response.status;
    throw error;
  }
  return body.result;
};

async function sendToTelegram(text) {
  if (!BOT_TOKEN || !CHAT_IDS.length) {
    console.warn(
      "[leads] TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не задан — сообщение не отправлено",
    );
    return;
  }

  await Promise.all(
    CHAT_IDS.map(async (chatId) => {
      const message = await telegram("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: statusKeyboard(),
      });
      rememberMessage(message.chat.id, message.message_id, text);
    }),
  );
}

// ---------- кнопки статуса: long polling ----------
const POLLING = process.env.TELEGRAM_POLLING !== "0";

async function handleCallback(query) {
  const code = (query.data || "").replace(/^st:/, "");
  const status = STATUS_LABELS[code];
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const html = messages.get(`${chatId}:${messageId}`);

  if (!status || !html) {
    await telegram("answerCallbackQuery", {
      callback_query_id: query.id,
      text: "Сообщение не найдено",
    });
    return;
  }

  const who =
    query.from?.username ||
    [query.from?.first_name, query.from?.last_name].filter(Boolean).join(" ");
  const updated = html.replace(
    /<b>Статус лида:<\/b> .*$/,
    `${STATUS_PREFIX}${escapeHtml(status)} · ${escapeHtml(who)}`,
  );

  await telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: updated,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: statusKeyboard(),
  }).catch((error) => {
    // «message is not modified» — статус тот же, это не ошибка
    if (!/not modified/.test(error.message)) throw error;
  });

  rememberMessage(chatId, messageId, updated);
  await telegram("answerCallbackQuery", {
    callback_query_id: query.id,
    text: `Статус: ${status}`,
  });
}

async function pollUpdates() {
  let offset = 0;
  for (;;) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 50,
        allowed_updates: ["callback_query"],
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.callback_query) {
          await handleCallback(update.callback_query).catch((error) =>
            console.error("[leads] кнопка статуса:", error.message),
          );
        }
      }
    } catch (error) {
      if (error.code === 409) {
        console.error(
          "[leads] getUpdates 409: у бота уже есть webhook или другой обработчик — кнопки статуса не будут работать. Используйте отдельного бота для сайта.",
        );
        return;
      }
      console.error("[leads] polling:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// ---------- перевірка заявки ----------
function validate(lead) {
  if (!lead || typeof lead !== "object") return "Некоректні дані";
  if (!TYPE_LABELS[lead.type]) return "Невідомий тип заявки";

  const data = lead.data || {};
  // honeypot: приховане поле, яке люди не заповнюють
  if (clean(data.website)) return "spam";

  const phoneDigits = clean(data.phone_full || data.phone).replace(/\D/g, "");
  const hasContact =
    phoneDigits.length >= 7 ||
    clean(data.email) ||
    clean(data.telegram) ||
    clean(data.messenger);

  if (lead.type === "chat-message")
    return clean(data.message) ? null : "Порожнє повідомлення";
  return hasContact ? null : "Немає контактних даних";
}

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/leads/health")
    return send(res, 200, { ok: true });
  if (req.method !== "POST" || !req.url.startsWith("/api/leads"))
    return send(res, 404, { error: "Not found" });

  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
  if (isRateLimited(ip))
    return send(res, 429, { error: "Забагато заявок, спробуйте пізніше" });

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > MAX_BODY) req.destroy();
  });

  req.on("end", async () => {
    let lead;
    try {
      lead = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: "Некоректний JSON" });
    }

    const error = validate(lead);
    // на спам відповідаємо «успіхом», щоб бот не підбирав обхід
    if (error === "spam") return send(res, 200, { ok: true });
    if (error) return send(res, 400, { error });

    const record = { ...lead, ip, receivedAt: new Date().toISOString() };

    try {
      fs.appendFileSync(DATA_FILE, `${JSON.stringify(record)}\n`);
    } catch (fileError) {
      console.error("[leads] не вдалося записати у файл:", fileError.message);
    }

    try {
      await sendToTelegram(formatMessage(lead));
    } catch (telegramError) {
      // заявка вже збережена у файлі — сайту відповідаємо успіхом, помилку пишемо в лог
      console.error("[leads] Telegram:", telegramError.message);
    }

    send(res, 200, { ok: true });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[leads] слушаю http://127.0.0.1:${PORT}/api/leads`);
  if (BOT_TOKEN && POLLING) pollUpdates();
});
