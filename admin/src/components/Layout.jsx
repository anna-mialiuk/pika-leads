import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import ErrorBoundary from "./ErrorBoundary";
import Icon from "./Icon";
import { useAuth } from "../lib/auth";
import logoMark from "../assets/logo-mark.svg";

import "./Layout.css";

const ROLE_LABELS = { admin: "Администратор", manager: "Менеджер" };

function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const nav = [
    { to: "/leads", icon: "leads", label: "Заявки (CRM)" },
    ...(user.role === "admin" ? [{ to: "/team", icon: "team", label: "Команда" }] : []),
    { to: "/profile", icon: "user", label: "Профиль" },
  ];

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
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `layout__link ${isActive ? "layout__link--active" : ""}`}>
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="layout__soon">
          <span>Скоро</span>
          Кейсы · Блог · Отзывы · Задачи · Аналитика
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
