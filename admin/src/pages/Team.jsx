import { useEffect, useState } from "react";

import Icon from "../components/Icon";
import { CopyButton, ErrorAlert, Field, Modal } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/format";
import { useMeta } from "../lib/meta";

import "./Team.css";
import { t, tt } from "../lib/i18n";

const ROLE_LABELS = { admin: t("Администратор"), manager: t("Менеджер") };
const ROLE_HINTS = {
  admin: t("Все заявки, удаление, управление командой"),
  manager: t("Все заявки: статусы, менеджеры, комментарии"),
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
      if (!window.confirm(tt("Выдать {0} новый временный пароль? Текущий пароль перестанет работать.", user.name))) return;
      const { user: updated, tempPassword } = await api(`/users/${user.id}/reset-password`, { method: "POST" });
      replace(updated);
      setCredentials({ user: updated, tempPassword, title: t("Новый временный пароль") });
    });

  const reset2fa = (user) =>
    action(async () => {
      if (!window.confirm(tt("Сбросить 2FA для {0}? При следующем входе нужно будет подключить её заново.", user.name))) return;
      const { user: updated } = await api(`/users/${user.id}/reset-2fa`, { method: "POST" });
      replace(updated);
    });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("Команда")}</h1>
          <p className="page-text">{t("Кто имеет доступ к панели. Новым сотрудникам выдаётся временный пароль.")}</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" />{" "}{t("Добавить сотрудника")}</button>
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
                    {u.name} {u.id === me.id && <span className="faint">{t("(вы)")}</span>}
                  </strong>
                  <div className="faint">{u.email}</div>
                </div>
              </div>

              <div className="team-member__badges">
                {u.disabled && <span className="badge team-badge team-badge--off">{t("Заблокирован")}</span>}
                {u.totpEnabled ? (
                  <span className="badge team-badge team-badge--ok">🛡 2FA</span>
                ) : (
                  <span className="badge team-badge">{t("2FA не подключена")}</span>
                )}
                {u.mustChangePassword && <span className="badge team-badge team-badge--warn">{t("Временный пароль")}</span>}
              </div>

              <div className="team-member__login faint">{t("Вход:")}{" "}{u.lastLoginAt ? formatDate(u.lastLoginAt) : t("ещё не входил")}</div>

              <div className="team-member__role">
                <select
                  className="select select--sm"
                  value={u.role}
                  onChange={(event) => update(u.id, { role: event.target.value })}
                  aria-label={t("Роль")}
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
                  aria-label={t("Должность")}
                >
                  <option value="">{t("Должность…")}</option>
                  {positions.map((p) => (
                    <option key={p} value={p}>
                      {t(p)}
                    </option>
                  ))}
                </select>
                {u.position === "Байер" && (
                  <input
                    className="input input--sm"
                    defaultValue={u.platform}
                    placeholder={t("Платформа: Meta, Google…")}
                    aria-label={t("Платформа байера")}
                    onBlur={(event) => event.target.value.trim() !== (u.platform || "") && update(u.id, { platform: event.target.value.trim() })}
                  />
                )}
              </div>

              <div className="team-member__actions">
                <button type="button" className="btn btn--sm" onClick={() => resetPassword(u)}>
                  <Icon name="key" />{" "}{t("Пароль")}</button>
                {u.totpEnabled && (
                  <button type="button" className="btn btn--sm" onClick={() => reset2fa(u)}>
                    <Icon name="shield" />{" "}{t("Сбросить 2FA")}</button>
                )}
                {u.id !== me.id && (
                  <button
                    type="button"
                    className={`btn btn--sm ${u.disabled ? "" : "btn--danger"}`}
                    onClick={() => update(u.id, { disabled: !u.disabled })}
                  >
                    {u.disabled ? t("Разблокировать") : t("Заблокировать")}
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
            setCredentials({ user, tempPassword, title: t("Сотрудник добавлен") });
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
    <Modal title={t("Новый сотрудник")} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label={t("Имя")}>
          <input className="input" value={form.name} onChange={set("name")} autoFocus required />
        </Field>
        <Field label={t("Email (логин)")}>
          <input className="input" type="email" value={form.email} onChange={set("email")} required />
        </Field>
        <Field label={t("Роль")}>
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
          <button type="button" className="btn" onClick={onClose}>{t("Отмена")}</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{t("Создать и получить пароль")}</button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialsModal({ user, tempPassword, title, onClose }) {
  const message = tt("Доступ к панели Pikaleads\nАдрес: {0}\nEmail: {1}\nВременный пароль: {2}\n\nПри первом входе нужно задать свой пароль и подключить 2FA (Google Authenticator).", window.location.origin, user.email, tempPassword);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>{t("Пароль показывается")}{" "}<b>{t("один раз")}</b>{t(". Отправьте его сотруднику лично (в Telegram или мессенджере).")}</p>
      <div className="credentials">
        <div>
          <span className="faint">Email</span>
          <b>{user.email}</b>
        </div>
        <div>
          <span className="faint">{t("Временный пароль")}</span>
          <b className="mono">{tempPassword}</b>
          <CopyButton value={tempPassword} label={t("Скопировать пароль")} />
        </div>
      </div>
      <div className="modal__actions">
        <CopyButton value={message} label={t("Скопировать сообщение для сотрудника")} className="btn">{t("Скопировать сообщение")}</CopyButton>
        <button type="button" className="btn btn--primary" onClick={onClose}>{t("Готово")}</button>
      </div>
    </Modal>
  );
}

export default Team;
