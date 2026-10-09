import { useEffect, useState } from "react";

import Icon from "../components/Icon";
import { CodeInput, ErrorAlert, Field, LangSwitch, PasswordInput, QrCode, StrengthMeter } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, passwordScore } from "../lib/format";

import "./Profile.css";
import { t } from "../lib/i18n";
import { ROLE_LABELS } from "../lib/roles";


function Profile() {
  const { user, setUser } = useAuth();
  const [require2fa, setRequire2fa] = useState(true);

  useEffect(() => {
    api("/auth/me")
      .then((data) => {
        setRequire2fa(data.require2fa);
        setUser(data.user);
      })
      .catch(() => {});
  }, [setUser]);

  return (
    <div className="profile">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("Профиль")}</h1>
          <p className="page-text">{t("Ваш доступ к панели и безопасность входа.")}</p>
        </div>
        <LangSwitch />
      </div>

      <div className="profile__grid">
        <section className="card profile__card">
          <h2>{t("Учётная запись")}</h2>
          <dl className="profile__dl">
            <div>
              <dt>{t("Имя")}</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>{t("Роль")}</dt>
              <dd>{ROLE_LABELS[user.role]}</dd>
            </div>
            <div>
              <dt>{t("Последний вход")}</dt>
              <dd>{formatDate(user.lastLoginAt)}</dd>
            </div>
          </dl>
        </section>

        <PasswordCard />
        <TwoFactorCard user={user} required={require2fa} onChange={setUser} />
        <TelegramCard user={user} onChange={setUser} />
      </div>
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setDone(false);
    if (next.length < 10) return setError(t("Минимум 10 символов"));
    if (passwordScore(next) < 3) return setError(t("Пароль слишком простой — добавьте цифры, заглавные буквы или символы"));
    if (next !== confirm) return setError(t("Пароли не совпадают"));
    setBusy(true);
    try {
      await api("/me/password", { method: "POST", body: { current, password: next } });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card profile__card">
      <h2>
        <Icon name="lock" />{" "}{t("Смена пароля")}</h2>
      <Field label={t("Текущий пароль")}>
        <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
      </Field>
      <span className="field__label">{t("Новый пароль")}</span>
      <div style={{ marginTop: 7 }}>
        <PasswordInput value={next} onChange={setNext} autoComplete="new-password" placeholder={t("Минимум 10 символов")} />
      </div>
      <StrengthMeter password={next} />
      <Field label={t("Повторите новый пароль")}>
        <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <ErrorAlert error={error} />
      {done && <div className="alert alert--ok">{t("✓ Пароль изменён. На других устройствах нужно будет войти заново.")}</div>}
      <button type="button" className="btn btn--primary" onClick={submit} disabled={busy}>{t("Сохранить пароль")}</button>
    </section>
  );
}

function TwoFactorCard({ user, required, onChange }) {
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn) => {
    setError("");
    try {
      await fn();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const startSetup = () => run(async () => setSetup(await api("/me/2fa/setup", { method: "POST" })));

  const enable = () =>
    run(async () => {
      const { user: updated } = await api("/me/2fa/enable", { method: "POST", body: { code } });
      onChange(updated);
      setSetup(null);
      setCode("");
    });

  const disable = () =>
    run(async () => {
      const { user: updated } = await api("/me/2fa/disable", { method: "POST", body: { code, password } });
      onChange(updated);
      setDisabling(false);
      setCode("");
      setPassword("");
    });

  return (
    <section className="card profile__card">
      <h2>
        <Icon name="shield" />{" "}{t("Двухфакторная защита")}</h2>
      {user.totpEnabled ? (
        <>
          <p className="profile__status profile__status--ok">{t("● Включена — при входе нужен код из приложения-аутентификатора.")}</p>
          <p className="muted profile__note">{t("Сменили телефон? Попросите администратора сбросить 2FA — при следующем входе вы подключите новое устройство.")}</p>
          {!required && !disabling && (
            <button type="button" className="btn btn--danger btn--sm" onClick={() => setDisabling(true)}>{t("Отключить 2FA")}</button>
          )}
          {disabling && (
            <>
              <Field label={t("Пароль")}>
                <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
              </Field>
              <span className="field__label">{t("Код из приложения")}</span>
              <div style={{ marginTop: 7 }}>
                <CodeInput value={code} onChange={setCode} autoFocus={false} />
              </div>
              <ErrorAlert error={error} />
              <button type="button" className="btn btn--danger" onClick={disable}>{t("Отключить")}</button>
            </>
          )}
        </>
      ) : setup ? (
        <>
          <div className="profile__qr">
            <QrCode text={setup.otpauth} size={150} />
            <p className="muted">{t("Отсканируйте QR-код в Google Authenticator, 1Password или Authy и введите код.")}</p>
          </div>
          <CodeInput value={code} onChange={setCode} onEnter={enable} />
          <ErrorAlert error={error} />
          <button type="button" className="btn btn--primary" onClick={enable}>{t("Включить 2FA")}</button>
        </>
      ) : (
        <>
          <p className="profile__status">{t("● Не подключена")}</p>
          <ErrorAlert error={error} />
          <button type="button" className="btn btn--primary" onClick={startSetup}>{t("Подключить 2FA")}</button>
        </>
      )}
    </section>
  );
}

/** Telegram для нагадувань про задачі */
function TelegramCard({ user, onChange }) {
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);

  // чекаємо, поки людина натисне Start у боті
  useEffect(() => {
    if (!waiting || user.telegram) return undefined;
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const data = await api("/auth/me");
        if (data.user.telegram || Date.now() - started > 3 * 60_000) {
          onChange(data.user);
          setWaiting(false);
        }
      } catch {
        /* спробуємо ще */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [waiting, user.telegram, onChange]);

  const connect = async () => {
    setError("");
    const tab = window.open("", "_blank");
    try {
      const { url } = await api("/me/telegram", { method: "POST" });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setWaiting(true);
    } catch (connectError) {
      tab?.close();
      setError(connectError.message);
    }
  };

  const disconnect = async () => {
    try {
      const { user: updated } = await api("/me/telegram", { method: "DELETE" });
      onChange(updated);
    } catch (disconnectError) {
      setError(disconnectError.message);
    }
  };

  return (
    <section className="card profile__card">
      <h2>
        <Icon name="send" size={18} />{" "}{t("Напоминания в Telegram")}</h2>
      {user.telegram ? (
        <>
          <p className="profile__status profile__status--ok">{t("● Подключён")}</p>
          <p className="profile__note muted">{t("Напоминания о ваших задачах приходят в личный чат с ботом — с кнопками «Готово» и «+1 час».")}</p>
          <button type="button" className="btn btn--sm" onClick={disconnect}>{t("Отключить")}</button>
        </>
      ) : (
        <>
          <p className="profile__status">{t("● Не подключён")}</p>
          <p className="profile__note muted">{t("Пока не подключено, напоминания приходят в общий чат заявок. Нажмите кнопку — откроется бот, нажмите в нём «Start».")}</p>
          <ErrorAlert error={error} />
          <button type="button" className="btn btn--primary" onClick={connect} disabled={waiting}>
            {waiting ? t("Ждём нажатия Start в боте…") : t("Подключить Telegram")}
          </button>
        </>
      )}
    </section>
  );
}

export default Profile;
