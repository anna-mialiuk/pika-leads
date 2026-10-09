/**
 * Telegram: повідомлення про заявку з кнопками статусу, оновлення статусу,
 * long polling натискань кнопок.
 */
import { BOT_TOKEN, CHAT_IDS, TELEGRAM_API } from "./config.mjs";
import { LEAD_TYPES, STATUS_BY_CODE, TELEGRAM_BUTTON_ORDER } from "./statuses.mjs";

export const telegramEnabled = () => Boolean(BOT_TOKEN && CHAT_IDS.length);

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

const STATUS_PREFIX = "<b>Статус лида:</b> ";
const STATUS_LINE = /<b>Статус лида:<\/b> .*$/;
// невидимий рядок (U+2800) розширює повідомлення — кнопки показують повний текст
const WIDE_SPACER = "⠀".repeat(48);

export const escapeHtml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const clean = (value, max = 1000) => String(value ?? "").trim().slice(0, max);

export function statusKeyboard() {
  const buttons = TELEGRAM_BUTTON_ORDER.map((code) => {
    const status = STATUS_BY_CODE[code];
    return { text: `${status.emoji} ${status.label}`, callback_data: `st:${code}` };
  });
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
}

// Telegram приймає до 4096 символів — довгі поля обрізаємо, щоб заявка точно дійшла
const MAX_MESSAGE = 4000;

export function formatMessage(lead) {
  for (const limits of [{ field: 300, message: 1500, click: 300 }, { field: 120, message: 400, click: 60 }, { field: 60, message: 150, click: 20 }]) {
    const html = buildMessage(lead, limits);
    if (html.length <= MAX_MESSAGE) return html;
  }
  return buildMessage(lead, { field: 30, message: 60, click: 0 });
}

function buildMessage(lead, limits) {
  const data = lead.data || {};
  const a = lead.attribution || {};
  const lines = [
    `🔥 <b>Новая заявка с сайта</b>${lead.id ? ` · #${lead.id}` : ""}`,
    `Форма: ${escapeHtml(LEAD_TYPES[lead.type] || lead.type)}`,
  ];

  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    let value = data[key];
    if (key === "phone_full" && !value) value = data.phone;
    if (Array.isArray(value)) value = value.join(", ");
    value = clean(value, key === "message" ? limits.message : limits.field);
    if (!value) continue;

    if (key === "phone_full") {
      const digits = value.replace(/[^\d+]/g, "");
      lines.push(`${label}: <a href="tel:${digits}">${escapeHtml(value)}</a>`);
    } else if ((key === "telegram" || key === "messenger") && /^@?\w{4,}$/.test(value)) {
      const username = value.replace(/^@/, "");
      lines.push(`${label}: <a href="https://t.me/${username}">@${escapeHtml(username)}</a>`);
    } else {
      lines.push(`${label}: ${escapeHtml(value)}`);
    }
  }

  const field = (label, value, max = limits.field) => `${label}: ${escapeHtml(clean(value, max)) || "—"}`;

  lines.push(
    "",
    field("Страница", lead.page),
    field("Откуда (кнопка)", lead.source, 60),
    field("Язык", lead.lang, 10),
    WIDE_SPACER,
    field("Кампания", a.utm_campaign),
    field("Ключ", a.utm_content),
    field("Место размещения", a.placement || a.utm_term),
    field("Сорч (источник)", a.utm_source),
    field("Канал (medium)", a.utm_medium),
    `Campaign ID: ${escapeHtml(clean(a.campaign_id || a.utm_id, 60))}`,
    `Adset ID: ${escapeHtml(clean(a.adset_id, 60))}`,
    `Ad ID: ${escapeHtml(clean(a.ad_id, 60))}`,
    `fbclid: ${escapeHtml(clean(a.fbclid, limits.click))}`,
    `gclid: ${escapeHtml(clean(a.gclid, limits.click))}`,
    `ttclid: ${escapeHtml(clean(a.ttclid, limits.click))}`,
    field("Реферер", a.referrer),
    "",
    `${STATUS_PREFIX}${STATUS_BY_CODE.new.label}`,
  );

  return lines.join("\n");
}

/** Рядок статусу в повідомленні: «Квалифицирован · roman» */
export const withStatus = (html, label, who) =>
  // функція, а не рядок: інакше «$&», «$`» в імені спрацюють як шаблони заміни
  html.replace(STATUS_LINE, () => `${STATUS_PREFIX}${escapeHtml(label)}${who ? ` · ${escapeHtml(clean(who, 64))}` : ""}`);

/** Підпис статусу з HTML повідомлення (для міграції старих повідомлень) */
export const statusFromHtml = (html) => {
  const match = String(html).match(/<b>Статус лида:<\/b> ([^·\n]+?)(?: · (.+))?$/m);
  return match ? { label: match[1].trim(), who: match[2]?.trim() || "" } : null;
};

export async function telegram(method, payload) {
  const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    const error = new Error(`Telegram ${method} ${response.status}: ${body.description || ""}`);
    error.code = response.status;
    throw error;
  }
  return body.result;
}

/** Надсилає повідомлення в усі чати, повертає [{ chatId, messageId }] */
export async function sendLeadMessage(html) {
  if (!telegramEnabled()) {
    console.warn("[leads] TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не задан — сообщение не отправлено");
    return [];
  }

  const results = await Promise.allSettled(
    CHAT_IDS.map((chatId) =>
      telegram("sendMessage", {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: statusKeyboard(),
      }),
    ),
  );

  const sent = [];
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      sent.push({ chatId: result.value.chat.id, messageId: result.value.message_id });
    } else {
      console.error("[leads] Telegram:", result.reason.message);
    }
  });
  return sent;
}

export async function editLeadMessage({ chatId, messageId }, html) {
  if (!telegramEnabled()) return;
  await telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: statusKeyboard(),
  }).catch((error) => {
    // «message is not modified» — статус той самий, це не помилка
    if (!/not modified/.test(error.message)) throw error;
  });
}

export const answerCallback = (id, text) =>
  telegram("answerCallbackQuery", { callback_query_id: id, text }).catch((error) =>
    console.error("[leads] answerCallbackQuery:", error.message),
  );

/** Long polling: натискання кнопок (статуси, задачі) і /start у особистому чаті (підключення нагадувань) */
export async function startPolling(onCallback, onMessage = async () => {}) {
  let offset = 0;
  for (;;) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 50,
        allowed_updates: ["callback_query", "message"],
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.callback_query) {
          await onCallback(update.callback_query).catch((error) =>
            console.error("[leads] кнопка статуса:", error.message),
          );
        } else if (update.message) {
          await onMessage(update.message).catch((error) => console.error("[leads] сообщение боту:", error.message));
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
