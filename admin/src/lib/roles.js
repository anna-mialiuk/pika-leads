import { t } from "./i18n";

/** Ролі панелі. Права дублюють серверні (server/leads/auth.mjs) — сервер усе одно перевіряє сам */
export const ROLE_LABELS = {
  admin: t("Администратор"),
  pm: t("Проект-менеджер"),
  manager: t("Менеджер"),
  buyer: t("Байер"),
  developer: t("Разработчик"),
};

export const ROLE_HINTS = {
  admin: t("Все заявки, удаление, управление командой"),
  pm: t("CRM, аналитика и задачи; управляет всеми проектами, задачами и созвонами"),
  manager: t("Все заявки: статусы, менеджеры, комментарии"),
  buyer: t("CRM, аналитика и задачи; попадает в список байеров проектов"),
  developer: t("Задачи и раздел «Сайт»: кейсы, блог, отзывы, SEO. Без доступа к заявкам"),
};

const PERMS = {
  leads: ["admin", "pm", "manager", "buyer"],
  content: ["admin", "developer"],
  manage: ["admin", "pm"],
};

export const can = (user, perm) => Boolean(user) && (PERMS[perm] || []).includes(user.role);

/** Стартова сторінка: у кого немає CRM — на задачі */
export const homePath = (user) => (can(user, "leads") ? "/leads" : "/tasks");
