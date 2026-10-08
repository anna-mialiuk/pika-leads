/**
 * Схеми форм контенту сайту. Типи полів:
 *   text / textarea — перекладний текст { uk, en, ru } (перемикач мов зверху)
 *   plain           — однаковий для всіх мов рядок (код, посилання)
 *   select / color / bool / date / image
 *   group           — вкладений об'єкт (fields)
 *   list            — список об'єктів (fields), можна додавати/видаляти/переставляти
 *   textList        — список перекладних рядків
 * Поля, яких немає в схемі, зберігаються як є (нічого не губиться).
 */
const COLORS = [
  { value: "green", label: "Зелёный" },
  { value: "yellow", label: "Жёлтый" },
  { value: "blue", label: "Синий" },
  { value: "pink", label: "Розовый" },
  { value: "linkedin", label: "LinkedIn (синий)" },
];

export const CASE_SOURCES = [
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "website", label: "Сайт" },
  { value: "uiux", label: "UI/UX" },
];

export const CASE_NICHES = [
  { value: "ecom", label: "E-commerce" },
  { value: "leadgen", label: "Лидогенерация" },
  { value: "webinar", label: "Вебинары и обучение" },
  { value: "franchise", label: "B2B и франшизы" },
  { value: "social", label: "Соцсети" },
  { value: "auto", label: "Авто и тюнинг" },
  { value: "crypto", label: "Крипта и финансы" },
  { value: "hr", label: "HR и рекрутинг" },
];

const screenshots = (key, label) => ({
  key,
  label,
  type: "list",
  itemLabel: "Скриншот",
  fields: [
    { key: "image", label: "Картинка", type: "image", preset: "screenshot" },
    { key: "alt", label: "Описание для поисковиков (alt)", type: "text" },
    { key: "caption", label: "Подпись под картинкой", type: "text" },
  ],
});

const valueRows = (key, label, { note = false, color = true } = {}) => ({
  key,
  label,
  type: "list",
  itemLabel: "Строка",
  inline: true,
  fields: [
    { key: "label", label: "Название", type: "text" },
    { key: "value", label: "Значение", type: "text" },
    ...(note ? [{ key: "note", label: "Примечание", type: "text" }] : []),
    ...(color ? [{ key: "type", label: "Цвет", type: "select", options: COLORS, empty: "—" }] : []),
  ],
});

const textBlock = (key, label) => ({
  key,
  label,
  type: "group",
  fields: [
    { key: "title", label: "Заголовок", type: "text" },
    { key: "description", label: "Текст", type: "textarea" },
  ],
});

export const caseSchema = [
  {
    section: "Карточка и обложка",
    fields: [
      { key: "title", label: "Название кейса", type: "text", required: true },
      { key: "kicker", label: "Надзаголовок", type: "text", hint: "Короткая строка над названием на странице кейса" },
      { key: "description", label: "Краткое описание", type: "textarea", rows: 3 },
      { key: "category", label: "Категория (бейдж)", type: "text", half: true },
      { key: "categoryColor", label: "Цвет бейджа", type: "color", half: true },
      { key: "source", label: "Источник трафика (фильтр)", type: "select", options: CASE_SOURCES, half: true },
      { key: "niche", label: "Ниша (фильтр)", type: "select", options: CASE_NICHES, half: true, allowCustom: true },
      { key: "platform", label: "Платформа", type: "plain", half: true, placeholder: "Meta" },
      { key: "number", label: "Номер кейса", type: "plain", half: true, placeholder: "25" },
      { key: "linkLabel", label: "Текст ссылки на карточке", type: "text", placeholder: "Смотреть кейс" },
      { key: "featured", label: "Показывать на главной", type: "bool" },
      {
        key: "image",
        label: "Обложка страницы кейса",
        type: "image",
        preset: "caseCover",
        hint: "Без обложки кейс не показывается в списке кейсов на сайте. Карточка 840×368 создаётся автоматически.",
        autoCard: "imageCard",
      },
      { key: "imageCard", label: "Картинка карточки (840×368)", type: "image", preset: "caseCard" },
    ],
  },
  {
    section: "Главные цифры",
    hint: "Цифры на карточке кейса. На страницах услуг берутся 2-я (результат) и 4-я (расход)",
    fields: [
      {
        key: "metrics",
        label: "Метрики",
        type: "list",
        itemLabel: "Метрика",
        inline: true,
        fields: [
          { key: "label", label: "Название", type: "text" },
          { key: "value", label: "Значение", type: "text" },
          { key: "type", label: "Цвет", type: "select", options: COLORS },
          { key: "accent", label: "Выделить", type: "bool" },
        ],
      },
    ],
  },
  {
    section: "Результаты",
    fields: [
      { key: "results.title", label: "Заголовок блока", type: "text" },
      valueRows("results.rows", "Таблица результатов", { note: true, color: false }),
      { key: "results.summary.title", label: "Итог: заголовок", type: "text", half: true },
      { key: "results.summary.badge", label: "Итог: бейдж", type: "text", half: true },
      valueRows("results.summary.items", "Итог: цифры"),
      { key: "results.summary.note", label: "Итог: примечание", type: "textarea", rows: 2 },
    ],
  },
  {
    section: "Контекст",
    fields: [
      { key: "context.title", label: "Заголовок", type: "text" },
      { key: "context.description", label: "Текст", type: "textarea" },
      screenshots("context.screenshots", "Скриншоты"),
    ],
  },
  {
    section: "История",
    fields: [
      { key: "history.title", label: "Заголовок", type: "text" },
      { key: "history.description", label: "Текст", type: "textarea" },
      screenshots("history.screenshots", "Скриншоты"),
    ],
  },
  {
    section: "Стратегия",
    fields: [
      { key: "strategy.title", label: "Заголовок блока", type: "text" },
      { key: "strategy.architecture", label: "Архитектура кампаний (пункты)", type: "textList", itemLabel: "Пункт" },
      screenshots("strategy.architectureScreenshots", "Скриншоты архитектуры"),
      textBlock("strategy.creative", "Креативы"),
      screenshots("strategy.creativeScreenshots", "Скриншоты креативов"),
      textBlock("strategy.optimization", "Оптимизация"),
      screenshots("strategy.optimizationScreenshots", "Скриншоты оптимизации"),
      { key: "strategy.mediaPlan.title", label: "Медиаплан: заголовок", type: "text" },
      valueRows("strategy.mediaPlan.items", "Медиаплан: строки"),
      { key: "strategy.mediaPlan.note", label: "Медиаплан: примечание", type: "textarea", rows: 2 },
      textBlock("strategy.summary", "Вывод"),
    ],
  },
  {
    section: "Доказательства",
    fields: [
      { key: "evidence.title", label: "Заголовок", type: "text" },
      { key: "evidence.description", label: "Текст", type: "textarea" },
      screenshots("evidence.screenshots", "Скриншоты из кабинета"),
    ],
  },
  {
    section: "Видео-отзыв",
    collapsed: true,
    fields: [
      { key: "videoReview.url", label: "Ссылка на YouTube", type: "plain", placeholder: "https://www.youtube.com/watch?v=…" },
      { key: "videoReview.title", label: "Заголовок", type: "text", half: true },
      { key: "videoReview.label", label: "Подпись кнопки", type: "text", half: true },
      { key: "videoReview.eyebrow", label: "Надпись сверху", type: "text", half: true },
      { key: "videoReview.name", label: "Название на превью", type: "text", half: true },
      { key: "videoReview.metric", label: "Цифра на превью", type: "text", half: true },
      {
        key: "videoReview.visual",
        label: "Картинка превью",
        type: "select",
        half: true,
        empty: "—",
        options: [
          { value: "lighting", label: "Свет" },
          { value: "furniture", label: "Мебель" },
        ],
      },
      { key: "videoReview.caption", label: "Подпись под видео", type: "text" },
    ],
  },
  {
    section: "Призыв в конце",
    collapsed: true,
    fields: [
      { key: "cta.title", label: "Заголовок", type: "text" },
      { key: "cta.description", label: "Текст", type: "textarea", rows: 2 },
      { key: "cta.buttonText", label: "Текст кнопки", type: "text", placeholder: "Получить разбор" },
      { key: "cta.buttonLink", label: "Ссылка кнопки", type: "plain", placeholder: "#consultation" },
    ],
  },
];

export const ARTICLE_TOPICS = [
  { value: "advertising", label: "Реклама и модерация" },
  { value: "analytics", label: "Аналитика и трекинг" },
  { value: "technical", label: "Технически" },
];

export const ARTICLE_LEVELS = [
  { value: "basic", label: "Базовый" },
  { value: "intermediate", label: "Средний" },
  { value: "advanced", label: "Продвинутый" },
];

export const articleSchema = [
  {
    section: "Карточка статьи",
    fields: [
      { key: "title", label: "Заголовок", type: "text", required: true },
      { key: "description", label: "Краткое описание (карточка и поисковики)", type: "textarea", rows: 3 },
      { key: "category", label: "Категория (бейдж)", type: "text", half: true, placeholder: "Аналитика" },
      {
        key: "type",
        label: "Цвет бейджа",
        type: "select",
        half: true,
        options: [
          { value: "blue", label: "Синий" },
          { value: "green", label: "Зелёный" },
          { value: "purple", label: "Фиолетовый" },
          { value: "yellow", label: "Жёлтый" },
          { value: "red", label: "Красный" },
        ],
      },
      { key: "topic", label: "Тема (фильтр)", type: "select", options: ARTICLE_TOPICS, half: true },
      { key: "level", label: "Уровень (фильтр)", type: "select", options: ARTICLE_LEVELS, half: true },
      { key: "date", label: "Дата публикации", type: "date", half: true },
      { key: "readTime", label: "Время чтения", type: "text", half: true, placeholder: "5 хв" },
      { key: "featured", label: "Показывать на главной", type: "bool" },
      { key: "image", label: "Обложка (16:9, 1200×675)", type: "image", preset: "blogCover" },
    ],
  },
];

export const reviewSchema = [
  {
    section: "Отзыв",
    fields: [
      { key: "name", label: "Имя", type: "text", half: true, required: true },
      { key: "initials", label: "Инициалы (аватар)", type: "text", half: true, placeholder: "ИМ" },
      { key: "category", label: "Услуга / категория", type: "text", half: true },
      { key: "badge", label: "Бейдж", type: "text", half: true, placeholder: "3+ года вместе" },
      { key: "meta", label: "Подпись (откуда отзыв)", type: "text", placeholder: "Местный эксперт · 13 отзывов" },
      { key: "text", label: "Текст отзыва", type: "textarea", rows: 6, required: true },
      { key: "expandable", label: "Длинный — показывать кнопку «Читать полностью»", type: "bool" },
    ],
  },
];

/** Порожні заготовки нових записів */
export const emptyCase = () => ({
  title: { uk: "" },
  description: { uk: "" },
  category: { uk: "" },
  categoryColor: "#4FD88A",
  source: "meta",
  niche: "ecom",
  platform: "Meta",
  status: "draft",
  metrics: [],
});

export const emptyArticle = () => ({
  title: { uk: "" },
  description: { uk: "" },
  category: { uk: "Реклама" },
  type: "purple",
  topic: "advertising",
  level: "intermediate",
  date: new Date().toISOString().slice(0, 10),
  readTime: { uk: "5 хв", en: "5 min", ru: "5 мин" },
  status: "draft",
});

export const emptyReview = () => ({
  name: { uk: "" },
  initials: { uk: "" },
  category: { uk: "" },
  meta: { uk: "" },
  badge: { uk: "" },
  text: { uk: "" },
  expandable: false,
});
