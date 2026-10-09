import { t } from "../lib/i18n";
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
  { value: "green", label: t("Зелёный") },
  { value: "yellow", label: t("Жёлтый") },
  { value: "blue", label: t("Синий") },
  { value: "pink", label: t("Розовый") },
  { value: "linkedin", label: t("LinkedIn (синий)") },
];

export const CASE_SOURCES = [
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "website", label: t("Сайт") },
  { value: "uiux", label: "UI/UX" },
];

export const CASE_NICHES = [
  { value: "ecom", label: "E-commerce" },
  { value: "leadgen", label: t("Лидогенерация") },
  { value: "webinar", label: t("Вебинары и обучение") },
  { value: "franchise", label: t("B2B и франшизы") },
  { value: "social", label: t("Соцсети") },
  { value: "auto", label: t("Авто и тюнинг") },
  { value: "crypto", label: t("Крипта и финансы") },
  { value: "hr", label: t("HR и рекрутинг") },
];

const screenshots = (key, label) => ({
  key,
  label,
  type: "list",
  itemLabel: t("Скриншот"),
  fields: [
    { key: "image", label: t("Картинка"), type: "image", preset: "screenshot" },
    { key: "alt", label: t("Описание для поисковиков (alt)"), type: "text" },
    { key: "caption", label: t("Подпись под картинкой"), type: "text" },
  ],
});

const valueRows = (key, label, { note = false, color = true } = {}) => ({
  key,
  label,
  type: "list",
  itemLabel: t("Строка"),
  inline: true,
  fields: [
    { key: "label", label: t("Название"), type: "text" },
    { key: "value", label: t("Значение"), type: "text" },
    ...(note ? [{ key: "note", label: t("Примечание"), type: "text" }] : []),
    ...(color ? [{ key: "type", label: t("Цвет"), type: "select", options: COLORS, empty: "—" }] : []),
  ],
});

const textBlock = (key, label) => ({
  key,
  label,
  type: "group",
  fields: [
    { key: "title", label: t("Заголовок"), type: "text" },
    { key: "description", label: t("Текст"), type: "textarea" },
  ],
});

export const caseSchema = [
  {
    section: t("Карточка и обложка"),
    fields: [
      { key: "title", label: t("Название кейса"), type: "text", required: true },
      { key: "kicker", label: t("Надзаголовок"), type: "text", hint: t("Короткая строка над названием на странице кейса") },
      { key: "description", label: t("Краткое описание"), type: "textarea", rows: 3 },
      { key: "category", label: t("Категория (бейдж)"), type: "text", half: true },
      { key: "categoryColor", label: t("Цвет бейджа"), type: "color", half: true },
      { key: "source", label: t("Источник трафика (фильтр)"), type: "select", options: CASE_SOURCES, half: true },
      { key: "niche", label: t("Ниша (фильтр)"), type: "select", options: CASE_NICHES, half: true, allowCustom: true },
      { key: "platform", label: t("Платформа"), type: "plain", half: true, placeholder: "Meta" },
      { key: "number", label: t("Номер кейса"), type: "plain", half: true, placeholder: "25" },
      { key: "linkLabel", label: t("Текст ссылки на карточке"), type: "text", placeholder: t("Смотреть кейс") },
      { key: "featured", label: t("Показывать на главной"), type: "bool" },
      {
        key: "image",
        label: t("Обложка страницы кейса"),
        type: "image",
        preset: "caseCover",
        hint: t("Без обложки кейс не показывается в списке кейсов на сайте. Карточка 840×368 создаётся автоматически."),
        autoCard: "imageCard",
      },
      { key: "imageCard", label: t("Картинка карточки (840×368)"), type: "image", preset: "caseCard" },
    ],
  },
  {
    section: t("Главные цифры"),
    hint: t("Цифры на карточке кейса. На страницах услуг берутся 2-я (результат) и 4-я (расход)"),
    fields: [
      {
        key: "metrics",
        label: t("Метрики"),
        type: "list",
        itemLabel: t("Метрика"),
        inline: true,
        fields: [
          { key: "label", label: t("Название"), type: "text" },
          { key: "value", label: t("Значение"), type: "text" },
          { key: "type", label: t("Цвет"), type: "select", options: COLORS },
          { key: "accent", label: t("Выделить"), type: "bool" },
        ],
      },
    ],
  },
  {
    section: t("Результаты"),
    fields: [
      { key: "results.title", label: t("Заголовок блока"), type: "text" },
      valueRows("results.rows", t("Таблица результатов"), { note: true, color: false }),
      { key: "results.summary.title", label: t("Итог: заголовок"), type: "text", half: true },
      { key: "results.summary.badge", label: t("Итог: бейдж"), type: "text", half: true },
      valueRows("results.summary.items", t("Итог: цифры")),
      { key: "results.summary.note", label: t("Итог: примечание"), type: "textarea", rows: 2 },
    ],
  },
  {
    section: t("Контекст"),
    fields: [
      { key: "context.title", label: t("Заголовок"), type: "text" },
      { key: "context.description", label: t("Текст"), type: "textarea" },
      screenshots("context.screenshots", t("Скриншоты")),
    ],
  },
  {
    section: t("История"),
    fields: [
      { key: "history.title", label: t("Заголовок"), type: "text" },
      { key: "history.description", label: t("Текст"), type: "textarea" },
      screenshots("history.screenshots", t("Скриншоты")),
    ],
  },
  {
    section: t("Стратегия"),
    fields: [
      { key: "strategy.title", label: t("Заголовок блока"), type: "text" },
      { key: "strategy.architecture", label: t("Архитектура кампаний (пункты)"), type: "textList", itemLabel: t("Пункт") },
      screenshots("strategy.architectureScreenshots", t("Скриншоты архитектуры")),
      textBlock("strategy.creative", t("Креативы")),
      screenshots("strategy.creativeScreenshots", t("Скриншоты креативов")),
      textBlock("strategy.optimization", t("Оптимизация")),
      screenshots("strategy.optimizationScreenshots", t("Скриншоты оптимизации")),
      { key: "strategy.mediaPlan.title", label: t("Медиаплан: заголовок"), type: "text" },
      valueRows("strategy.mediaPlan.items", t("Медиаплан: строки")),
      { key: "strategy.mediaPlan.note", label: t("Медиаплан: примечание"), type: "textarea", rows: 2 },
      textBlock("strategy.summary", t("Вывод")),
    ],
  },
  {
    section: t("Доказательства"),
    fields: [
      { key: "evidence.title", label: t("Заголовок"), type: "text" },
      { key: "evidence.description", label: t("Текст"), type: "textarea" },
      screenshots("evidence.screenshots", t("Скриншоты из кабинета")),
    ],
  },
  {
    section: t("Видео-отзыв"),
    collapsed: true,
    fields: [
      { key: "videoReview.url", label: t("Ссылка на YouTube"), type: "plain", placeholder: "https://www.youtube.com/watch?v=…" },
      { key: "videoReview.title", label: t("Заголовок"), type: "text", half: true },
      { key: "videoReview.label", label: t("Подпись кнопки"), type: "text", half: true },
      { key: "videoReview.eyebrow", label: t("Надпись сверху"), type: "text", half: true },
      { key: "videoReview.name", label: t("Название на превью"), type: "text", half: true },
      { key: "videoReview.metric", label: t("Цифра на превью"), type: "text", half: true },
      {
        key: "videoReview.visual",
        label: t("Картинка превью"),
        type: "select",
        half: true,
        empty: "—",
        options: [
          { value: "lighting", label: t("Свет") },
          { value: "furniture", label: t("Мебель") },
        ],
      },
      { key: "videoReview.caption", label: t("Подпись под видео"), type: "text" },
    ],
  },
  {
    section: t("Призыв в конце"),
    collapsed: true,
    fields: [
      { key: "cta.title", label: t("Заголовок"), type: "text" },
      { key: "cta.description", label: t("Текст"), type: "textarea", rows: 2 },
      { key: "cta.buttonText", label: t("Текст кнопки"), type: "text", placeholder: t("Получить разбор") },
      { key: "cta.buttonLink", label: t("Ссылка кнопки"), type: "plain", placeholder: "#consultation" },
    ],
  },
];

export const ARTICLE_TOPICS = [
  { value: "advertising", label: t("Реклама и модерация") },
  { value: "analytics", label: t("Аналитика и трекинг") },
  { value: "technical", label: t("Технически") },
];

export const ARTICLE_LEVELS = [
  { value: "basic", label: t("Базовый") },
  { value: "intermediate", label: t("Средний") },
  { value: "advanced", label: t("Продвинутый") },
];

export const articleSchema = [
  {
    section: t("Карточка статьи"),
    fields: [
      { key: "title", label: t("Заголовок"), type: "text", required: true },
      { key: "description", label: t("Краткое описание (карточка и поисковики)"), type: "textarea", rows: 3 },
      { key: "category", label: t("Категория (бейдж)"), type: "text", half: true, placeholder: t("Аналитика") },
      {
        key: "type",
        label: t("Цвет бейджа"),
        type: "select",
        half: true,
        options: [
          { value: "blue", label: t("Синий") },
          { value: "green", label: t("Зелёный") },
          { value: "purple", label: t("Фиолетовый") },
          { value: "yellow", label: t("Жёлтый") },
          { value: "red", label: t("Красный") },
        ],
      },
      { key: "topic", label: t("Тема (фильтр)"), type: "select", options: ARTICLE_TOPICS, half: true },
      { key: "level", label: t("Уровень (фильтр)"), type: "select", options: ARTICLE_LEVELS, half: true },
      { key: "date", label: t("Дата публикации"), type: "date", half: true },
      { key: "readTime", label: t("Время чтения"), type: "text", half: true, placeholder: t("5 хв") },
      { key: "featured", label: t("Показывать на главной"), type: "bool" },
      { key: "image", label: t("Обложка (16:9, 1200×675)"), type: "image", preset: "blogCover" },
    ],
  },
];

export const reviewSchema = [
  {
    section: t("Отзыв"),
    fields: [
      { key: "name", label: t("Имя"), type: "text", half: true, required: true },
      { key: "initials", label: t("Инициалы (аватар)"), type: "text", half: true, placeholder: t("ИМ") },
      { key: "category", label: t("Услуга / категория"), type: "text", half: true },
      { key: "badge", label: t("Бейдж"), type: "text", half: true, placeholder: t("3+ года вместе") },
      { key: "meta", label: t("Подпись (откуда отзыв)"), type: "text", placeholder: t("Местный эксперт · 13 отзывов") },
      { key: "text", label: t("Текст отзыва"), type: "textarea", rows: 6, required: true },
      { key: "expandable", label: t("Длинный — показывать кнопку «Читать полностью»"), type: "bool" },
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
  category: { uk: t("Реклама") },
  type: "purple",
  topic: "advertising",
  level: "intermediate",
  date: new Date().toISOString().slice(0, 10),
  readTime: { uk: t("5 хв"), en: "5 min", ru: t("5 мин") },
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
