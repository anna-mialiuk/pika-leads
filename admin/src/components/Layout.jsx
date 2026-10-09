import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import ErrorBoundary from "./ErrorBoundary";
import Icon from "./Icon";
import { LangSwitch } from "./ui";
import { useAuth } from "../lib/auth";
import { usePublish } from "../lib/publish";
import { useTasks } from "../lib/tasks";
import logoMark from "../assets/logo-mark.svg";

import "./Layout.css";
import { t, tt, LOCALE } from "../lib/i18n";
import { ROLE_LABELS, can } from "../lib/roles";


const ago = (iso) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return t("только что");
  if (minutes < 60) return tt("{0} мин назад", minutes);
  const hours = Math.round(minutes / 60);
  return hours < 24 ? tt("{0} ч назад", hours) : new Date(iso).toLocaleDateString(LOCALE);
};

/** Стан публікації сайту (GitHub Actions) */
function PublishStatus() {
  const { status, run, waiting } = usePublish();
  if (!status) return null;
  if (status.configured === false) {
    return (
      <div className="publish publish--off" title={t("Нет GITHUB_TOKEN в настройках сервера")}>
        <span className="publish__dot" />{" "}{t("Публикация не настроена")}</div>
    );
  }
  let state = "ok";
  let text = t("Сайт обновлён");
  if (waiting && (!run || run.status !== "completed")) {
    state = "busy";
    text = run?.status === "in_progress" ? t("Сайт обновляется…") : t("Ждём сборку…");
  } else if (run && run.status !== "completed") {
    state = "busy";
    text = t("Сайт обновляется…");
  } else if (run && run.conclusion && run.conclusion !== "success") {
    state = "fail";
    text = t("Ошибка обновления сайта");
  }
  const body = (
    <>
      <span className="publish__dot" />
      <span>
        {text}
        {run?.updatedAt && <small>{state === "busy" ? t("обычно 2–3 минуты") : ago(run.updatedAt)}</small>}
      </span>
    </>
  );
  return run?.url ? (
    <a className={`publish publish--${state}`} href={run.url} target="_blank" rel="noreferrer noopener" title={t("Открыть сборку в GitHub")}>
      {body}
    </a>
  ) : (
    <div className={`publish publish--${state}`}>{body}</div>
  );
}

function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const isAdmin = user.role === "admin";
  const canLeads = can(user, "leads");
  const canContent = can(user, "content");
  const { myDueCount } = useTasks();
  const nav = [
    ...(canLeads ? [{ to: "/leads", icon: "leads", label: t("Заявки (CRM)") }] : []),
    {
      to: "/tasks",
      icon: "tasks",
      label: t("Задачи"),
      badge: myDueCount,
      subs: [
        { to: "/tasks", label: t("Задачи"), dot: "#FFC629" },
        { to: "/tasks/gantt", label: t("Диаграмма Ганта"), dot: "#f0a53e" },
        { to: "/tasks/calendar", label: t("Календарь"), dot: "#5b9bff" },
        { to: "/tasks/projects", label: t("Проекты"), dot: "#4fd88a" },
        { to: "/tasks/mindmaps", label: t("Майнд-карты"), dot: "#b98bff" },
        { to: "/tasks/files", label: t("Файлы"), dot: "#f0883e" },
        { to: "/tasks/calls", label: t("Звонки"), dot: "#b98bff" },
        { to: "/tasks/analytics", label: t("Аналитика"), dot: "#4fd8c8" },
        { to: "/tasks/chat", label: t("Рабочий чат"), dot: "#ff7d7d" },
        { to: "/tasks/settings", label: t("Настройки"), dot: "#8a8f98" },
      ],
    },
    ...(canLeads ? [{ to: "/analytics", icon: "chart", label: t("Аналитика") }] : []),
    ...(isAdmin
      ? [
          { to: "/team", icon: "team", label: t("Команда") },
          { to: "/integrations", icon: "link", label: t("Интеграции") },
        ]
      : []),
    { to: "/profile", icon: "user", label: t("Профиль") },
  ];
  const siteNav = canContent
    ? [
        { to: "/cases", icon: "cases", label: t("Кейсы") },
        { to: "/blog", icon: "blog", label: t("Блог") },
        { to: "/reviews", icon: "reviews", label: t("Отзывы") },
        { to: "/seo", icon: "search", label: "SEO" },
      ]
    : [];

  const inTasks = location.pathname === "/tasks" || location.pathname.startsWith("/tasks/");
  // підменю «Задачи»: відкрите в розділі задач, кнопкою можна згорнути/розгорнути
  const [tasksToggle, setTasksToggle] = useState(null);
  const tasksOpen = tasksToggle ?? inTasks;
  const setTasksOpen = setTasksToggle;

  const link = (item) => {
    if (item.subs) {
      const open = tasksOpen;
      return (
        <div key={item.to}>
          <div className={`layout__link layout__link--group ${inTasks ? "layout__link--active" : ""}`}>
            <NavLink to={item.to} end className="layout__link-main" onClick={() => setTasksOpen(true)}>
              <Icon name={item.icon} size={18} />
              {item.label}
              {item.badge > 0 && <span className="layout__badge">{item.badge}</span>}
            </NavLink>
            <button
              type="button"
              className={`layout__caret ${open ? "is-open" : ""}`}
              aria-label={open ? t("Свернуть") : t("Развернуть")}
              aria-expanded={open}
              onClick={() => setTasksOpen(!open)}
            >
              ▾
            </button>
          </div>
          {open && (
            <div className="layout__subnav">
              {item.subs.map((sub) => (
                <NavLink
                  key={sub.to}
                  to={sub.to}
                  end
                  className={({ isActive }) => `layout__sublink ${isActive ? "is-active" : ""}`}
                  style={{ "--dot": sub.dot }}
                >
                  <i />
                  {sub.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <NavLink key={item.to} to={item.to} className={({ isActive }) => `layout__link ${isActive ? "layout__link--active" : ""}`}>
        <Icon name={item.icon} size={18} />
        {item.label}
        {item.badge > 0 && <span className="layout__badge">{item.badge}</span>}
      </NavLink>
    );
  };

  return (
    <div className="layout">
      <header className="layout__topbar">
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={t("Меню")}>
          <Icon name="menu" />
        </button>
        <div className="layout__brand layout__brand--top">
          <img src={logoMark} alt="" />
          <div>
            PIKA<span>LEADS</span>
          </div>
        </div>
      </header>

      {open && <div className="layout__scrim" onClick={() => setOpen(false)} />}

      <aside className={`layout__sidebar ${open ? "layout__sidebar--open" : ""}`}>
        <div className="layout__brand">
          <img src={logoMark} alt="" />
          <div>
            PIKA<span>LEADS</span>
            <small>admin</small>
          </div>
        </div>

        <nav className="layout__nav">
          {nav.map(link)}
          {siteNav.length > 0 && <div className="layout__nav-title">{t("Сайт")}</div>}
          {siteNav.map(link)}
        </nav>

        {canContent && <PublishStatus />}

        <LangSwitch className="layout__lang" />

        <div className="layout__user">
          <div className="layout__avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="layout__user-info">
            <strong>{user.name}</strong>
            <small>{ROLE_LABELS[user.role]}</small>
          </div>
          <button type="button" className="icon-btn" onClick={logout} title={t("Выйти")} aria-label={t("Выйти")}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="layout__content">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default Layout;
