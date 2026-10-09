import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import ErrorBoundary from "./ErrorBoundary";
import Icon from "./Icon";
import { useAuth } from "../lib/auth";
import { usePublish } from "../lib/publish";
import { useTasks } from "../lib/tasks";
import logoMark from "../assets/logo-mark.svg";

import "./Layout.css";

const ROLE_LABELS = { admin: "Администратор", manager: "Менеджер" };

const ago = (iso) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} ч назад` : new Date(iso).toLocaleDateString("ru-RU");
};

/** Стан публікації сайту (GitHub Actions) */
function PublishStatus() {
  const { status, run, waiting } = usePublish();
  if (!status) return null;
  if (status.configured === false) {
    return (
      <div className="publish publish--off" title="Нет GITHUB_TOKEN в настройках сервера">
        <span className="publish__dot" /> Публикация не настроена
      </div>
    );
  }
  let state = "ok";
  let text = "Сайт обновлён";
  if (waiting && (!run || run.status !== "completed")) {
    state = "busy";
    text = run?.status === "in_progress" ? "Сайт обновляется…" : "Ждём сборку…";
  } else if (run && run.status !== "completed") {
    state = "busy";
    text = "Сайт обновляется…";
  } else if (run && run.conclusion && run.conclusion !== "success") {
    state = "fail";
    text = "Ошибка обновления сайта";
  }
  const body = (
    <>
      <span className="publish__dot" />
      <span>
        {text}
        {run?.updatedAt && <small>{state === "busy" ? "обычно 2–3 минуты" : ago(run.updatedAt)}</small>}
      </span>
    </>
  );
  return run?.url ? (
    <a className={`publish publish--${state}`} href={run.url} target="_blank" rel="noreferrer noopener" title="Открыть сборку в GitHub">
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
  const { myDueCount } = useTasks();
  const nav = [
    { to: "/leads", icon: "leads", label: "Заявки (CRM)" },
    {
      to: "/tasks",
      icon: "tasks",
      label: "Задачи",
      badge: myDueCount,
      subs: [
        { to: "/tasks", label: "Задачи", dot: "#FFC629" },
        { to: "/tasks/gantt", label: "Диаграмма Ганта", dot: "#f0a53e" },
        { to: "/tasks/calendar", label: "Календарь", dot: "#5b9bff" },
        { to: "/tasks/projects", label: "Проекты", dot: "#4fd88a" },
        { to: "/tasks/mindmaps", label: "Майнд-карты", dot: "#b98bff" },
        { to: "/tasks/files", label: "Файлы", dot: "#f0883e" },
        { to: "/tasks/calls", label: "Звонки", dot: "#b98bff" },
        { to: "/tasks/analytics", label: "Аналитика", dot: "#4fd8c8" },
        { to: "/tasks/chat", label: "Рабочий чат", dot: "#ff7d7d" },
        { to: "/tasks/settings", label: "Настройки", dot: "#8a8f98" },
      ],
    },
    { to: "/analytics", icon: "chart", label: "Аналитика" },
    ...(isAdmin
      ? [
          { to: "/team", icon: "team", label: "Команда" },
          { to: "/integrations", icon: "link", label: "Интеграции" },
        ]
      : []),
    { to: "/profile", icon: "user", label: "Профиль" },
  ];
  const siteNav = isAdmin
    ? [
        { to: "/cases", icon: "cases", label: "Кейсы" },
        { to: "/blog", icon: "blog", label: "Блог" },
        { to: "/reviews", icon: "reviews", label: "Отзывы" },
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
              aria-label={open ? "Свернуть" : "Развернуть"}
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
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Меню">
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
          {siteNav.length > 0 && <div className="layout__nav-title">Сайт</div>}
          {siteNav.map(link)}
        </nav>

        {isAdmin && <PublishStatus />}

        <div className="layout__user">
          <div className="layout__avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="layout__user-info">
            <strong>{user.name}</strong>
            <small>{ROLE_LABELS[user.role]}</small>
          </div>
          <button type="button" className="icon-btn" onClick={logout} title="Выйти" aria-label="Выйти">
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
