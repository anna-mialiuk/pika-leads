import { useEffect, useState } from "react";

import Icon from "../components/Icon";
import { CopyButton, ErrorAlert, Field, Modal } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/format";
import { useMeta } from "../lib/meta";

import "./Team.css";

const ROLE_LABELS = { admin: "Администратор", manager: "Менеджер" };
const ROLE_HINTS = {
  admin: "Все заявки, удаление, управление командой",
  manager: "Все заявки: статусы, менеджеры, комментарии",
};

/** Команда: співробітники, ролі, тимчасові паролі, скидання 2FA */
function Team() {
  const { user: me } = useAuth();
  const { reloadUsers, positions = [] } = useMeta();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const load = () =>
    api("/users")
      .then(({ users: list }) => setUsers(list))
      .catch((loadError) => setError(loadError.message));

  useEffect(() => {
    load();
  }, []);

  const replace = (user) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
    reloadUsers();
  };

  const action = async (fn) => {
    setError("");
    try {
      await fn();
    } catch (actionError) {
      setError(actionError.message);
    }
  };

  const update = (id, body) =>
    action(async () => {
      const { user } = await api(`/users/${id}`, { method: "PATCH", body });
      replace(user);
    });

  const resetPassword = (user) =>
    action(async () => {
      if (!window.confirm(`Выдать ${user.name} новый временный пароль? Текущий пароль перестанет работать.`)) return;
      const { user: updated, tempPassword } = await api(`/users/${user.id}/reset-password`, { method: "POST" });
      replace(updated);
      setCredentials({ user: updated, tempPassword, title: "Новый временный пароль" });
    });

  const reset2fa = (user) =>
    action(async () => {
      if (!window.confirm(`Сбросить 2FA для ${user.name}? При следующем входе нужно будет подключить её заново.`)) return;
      const { user: updated } = await api(`/users/${user.id}/reset-2fa`, { method: "POST" });
      replace(updated);
    });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Команда</h1>
          <p className="page-text">Кто имеет доступ к панели. Новым сотрудникам выдаётся временный пароль.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" /> Добавить сотрудника
        </button>
      </div>

      <div className="roles">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <div key={role} className="card roles__card">
            <strong>{label}</strong>
            <span>{ROLE_HINTS[role]}</span>
          </div>
        ))}
      </div>

      <ErrorAlert error={error} />

      {!users ? (
        <div className="spinner" />
      ) : (
        <div className="team-list">
          {users.map((u) => (
            <article key={u.id} className={`card team-member ${u.disabled ? "is-disabled" : ""}`}>
              <div className="team-member__who">
                <div className="layout__avatar">{u.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>
                    {u.name} {u.id === me.id && <span className="faint">(вы)</span>}
                  </strong>
                  <div className="faint">{u.email}</div>
                </div>
              </div>

              <div className="team-member__badges">
                {u.disabled && <span className="badge team-badge team-badge--off">Заблокирован</span>}
                {u.totpEnabled ? (
                  <span className="badge team-badge team-badge--ok">🛡 2FA</span>
                ) : (
                  <span className="badge team-badge">2FA не подключена</span>
                )}
                {u.mustChangePassword && <span className="badge team-badge team-badge--warn">Временный пароль</span>}
              </div>

              <div className="team-member__login faint">Вход: {u.lastLoginAt ? formatDate(u.lastLoginAt) : "ещё не входил"}</div>

              <div className="team-member__role">
                <select
                  className="select select--sm"
                  value={u.role}
                  onChange={(event) => update(u.id, { role: event.target.value })}
                  aria-label="Роль"
                >
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className="select select--sm"
                  value={u.position || ""}
                  onChange={(event) => update(u.id, { position: event.target.value })}
                  aria-label="Должность"
                >
                  <option value="">Должность…</option>
                  {positions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {u.position === "Байер" && (
                  <input
                    className="input input--sm"
                    defaultValue={u.platform}
                    placeholder="Платформа: Meta, Google…"
                    aria-label="Платформа байера"
                    onBlur={(event) => event.target.value.trim() !== (u.platform || "") && update(u.id, { platform: event.target.value.trim() })}
                  />
                )}
              </div>

              <div className="team-member__actions">
                <button type="button" className="btn btn--sm" onClick={() => resetPassword(u)}>
                  <Icon name="key" /> Пароль
                </button>
                {u.totpEnabled && (
                  <button type="button" className="btn btn--sm" onClick={() => reset2fa(u)}>
                    <Icon name="shield" /> Сбросить 2FA
                  </button>
                )}
                {u.id !== me.id && (
                  <button
                    type="button"
                    className={`btn btn--sm ${u.disabled ? "" : "btn--danger"}`}
                    onClick={() => update(u.id, { disabled: !u.disabled })}
                  >
                    {u.disabled ? "Разблокировать" : "Заблокировать"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={({ user, tempPassword }) => {
            setUsers((prev) => [...prev, user]);
            reloadUsers();
            setCreating(false);
            setCredentials({ user, tempPassword, title: "Сотрудник добавлен" });
          }}
        />
      )}

      {credentials && <CredentialsModal {...credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", email: "", role: "manager" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onCreated(await api("/users", { method: "POST", body: form }));
    } catch (createError) {
      setError(createError.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Новый сотрудник" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Имя">
          <input className="input" value={form.name} onChange={set("name")} autoFocus required />
        </Field>
        <Field label="Email (логин)">
          <input className="input" type="email" value={form.email} onChange={set("email")} required />
        </Field>
        <Field label="Роль">
          <select className="select" value={form.role} onChange={set("role")}>
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <option key={role} value={role}>
                {label} — {ROLE_HINTS[role]}
              </option>
            ))}
          </select>
        </Field>
        <ErrorAlert error={error} />
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Создать и получить пароль
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialsModal({ user, tempPassword, title, onClose }) {
  const message = `Доступ к панели Pikaleads\nАдрес: ${window.location.origin}\nEmail: ${user.email}\nВременный пароль: ${tempPassword}\n\nПри первом входе нужно задать свой пароль и подключить 2FA (Google Authenticator).`;
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Пароль показывается <b>один раз</b>. Отправьте его сотруднику лично (в Telegram или мессенджере).
      </p>
      <div className="credentials">
        <div>
          <span className="faint">Email</span>
          <b>{user.email}</b>
        </div>
        <div>
          <span className="faint">Временный пароль</span>
          <b className="mono">{tempPassword}</b>
          <CopyButton value={tempPassword} label="Скопировать пароль" />
        </div>
      </div>
      <div className="modal__actions">
        <CopyButton value={message} label="Скопировать сообщение для сотрудника" className="btn">
          Скопировать сообщение
        </CopyButton>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Готово
        </button>
      </div>
    </Modal>
  );
}

export default Team;
