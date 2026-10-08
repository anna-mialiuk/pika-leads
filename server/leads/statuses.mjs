/**
 * Єдиний список статусів ліда — і для кнопок у Telegram, і для CRM в адмінці.
 * Порядок = колонки канбану. code не змінювати (зберігається в даних).
 */
export const STATUSES = [
  { code: "new", label: "Новый", emoji: "🆕", color: "#FFC629", final: false, button: false },
  { code: "call", label: "Идём на звонок", emoji: "📞", color: "#5b9bff", final: false, button: true },
  { code: "scheduled", label: "Запланирован звонок", emoji: "📅", color: "#4fd8c8", final: false, button: true },
  { code: "no_answer", label: "Не дозвонились", emoji: "📵", color: "#f0a53e", final: false, button: true },
  { code: "no_pickup", label: "Не берёт трубку", emoji: "📴", color: "#f0883e", final: false, button: true },
  { code: "qualified", label: "Квалифицирован", emoji: "✅", color: "#8bd450", final: false, button: true },
  { code: "proposal", label: "Скинуть КП", emoji: "📄", color: "#b98bff", final: false, button: true },
  { code: "sale", label: "Продажа", emoji: "💰", color: "#4fd88a", final: true, button: true },
  { code: "unqualified", label: "Не квалифицирован", emoji: "⛔", color: "#8a8f98", final: true, button: true },
  { code: "refused", label: "Отказ", emoji: "❌", color: "#ff7d7d", final: true, button: true },
];

// Порядок кнопок у Telegram — як було раніше (по дві в рядку)
export const TELEGRAM_BUTTON_ORDER = [
  "call",
  "unqualified",
  "no_answer",
  "no_pickup",
  "qualified",
  "scheduled",
  "proposal",
  "sale",
  "refused",
];

// без прототипа: ключі на кшталт "__proto__" / "constructor" не знаходять вбудованих об'єктів
export const STATUS_BY_CODE = Object.assign(Object.create(null), Object.fromEntries(STATUSES.map((s) => [s.code, s])));
export const STATUS_BY_LABEL = Object.assign(Object.create(null), Object.fromEntries(STATUSES.map((s) => [s.label, s])));
export const isStatus = (code) => typeof code === "string" && Object.hasOwn(STATUS_BY_CODE, code);

export const LEAD_TYPES = Object.freeze({
  consultation: "Консультация",
  audit: "Аудит рекламы",
  "service-audit": "Аудит (страница услуги)",
  question: "Вопрос со страницы контактов",
  bonus: "Колесо бонусов",
  callback: "Перезвонить",
  "chat-callback": "Звонок из чата",
  "chat-message": "Сообщение в чате",
  manual: "Добавлен вручную",
});

export const isLeadType = (type) => typeof type === "string" && Object.hasOwn(LEAD_TYPES, type);
