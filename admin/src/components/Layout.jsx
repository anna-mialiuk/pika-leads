import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import ErrorBoundary from "./ErrorBoundary";
import Icon from "./Icon";
import { useAuth } from "../lib/auth";
import { usePublish } from "../lib/publish";
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
  const nav = [
    { to: "/leads", icon: "leads", label: "Заявки (CRM)" },
    ...(isAdmin ? [{ to: "/team", icon: "team", label: "Команда" }] : []),
    { to: "/profile", icon: "user", label: "Профиль" },
  ];
  const siteNav = isAdmin
    ? [
        { to: "/cases", icon: "cases", label: "Кейсы" },
        { to: "/blog", icon: "blog", label: "Блог" },
        { to: "/reviews", icon: "reviews", label: "Отзывы" },
      ]
    : [];

  const link = (item) => (
    <NavLink key={item.to} to={item.to} className={({ isActive }) => `layout__link ${isActive ? "layout__link--active" : ""}`}>
      <Icon name={item.icon} size={18} />
      {item.label}
    </NavLink>
  );

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

        <div className="layout__soon">
          <span>Скоро</span>
          Задачи · Аналитика · SEO
        </div>

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
