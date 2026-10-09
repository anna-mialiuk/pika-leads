import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import Icon from "../components/Icon";
import { CodeInput, CopyButton, ErrorAlert, LangSwitch, PasswordInput, QrCode, StrengthMeter } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { passwordScore } from "../lib/format";
import logoMark from "../assets/logo-mark.svg";

import "./Login.css";
import { t } from "../lib/i18n";

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/**
 * Вхід у панель (за макетом Pikaleads Login):
 * пароль → (зміна тимчасового пароля) → 2FA або підключення 2FA → панель.
 */
function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // посилання з листа: /login#reset=<токен>
  const [resetToken, setResetToken] = useState(() => /reset=([\w-]+)/.exec(window.location.hash)?.[1] || "");
  const [screen, setScreen] = useState(resetToken ? "reset" : "login");
  const [forgotAvailable, setForgotAvailable] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [step, setStep] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // посилання з листа відкрили у вже відкритій вкладці входу
  useEffect(() => {
    const onHash = () => {
      const token = /reset=([\w-]+)/.exec(window.location.hash)?.[1];
      if (token) {
        setResetToken(token);
        setError("");
        setScreen("reset");
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (screen !== "forgot" || forgotAvailable !== null) return;
    api("/auth/forgot")
      .then(({ available }) => setForgotAvailable(available))
      .catch(() => setForgotAvailable(false));
  }, [screen, forgotAvailable]);

  if (user && screen !== "success") return <Navigate to={location.state?.from || "/leads"} replace />;

  const go = (next) => {
    setError("");
    setCode("");
    setScreen(next);
  };

  /** Відповідь сервера → наступний екран */
  const handleStep = (response) => {
    setStep(response);
    if (response.status === "ok") {
      setScreen("success");
      setTimeout(() => {
        setUser(response.user);
        navigate(location.state?.from || "/leads", { replace: true });
      }, 900);
      return;
    }
    go({ "change-password": "change", "2fa": "twofa", "setup-2fa": "setup" }[response.status]);
  };

  const run = async (action) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      handleStep(await action());
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401 && /истекла/.test(requestError.message)) {
        setScreen("login");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = () => {
    if (!validEmail(email)) return setError(t("Введите корректный email"));
    if (!password) return setError(t("Введите пароль"));
    run(() => api("/auth/login", { method: "POST", body: { email, password, remember } }));
  };

  const submitCode = (path) => {
    if (code.length !== 6) return setError(t("Введите 6-значный код"));
    run(() => api(path, { method: "POST", body: { ticket: step.ticket, code } }));
  };

  const submitNewPassword = () => {
    if (newPass.length < 10) return setError(t("Минимум 10 символов"));
    if (passwordScore(newPass) < 3) return setError(t("Пароль слишком простой — добавьте цифры, заглавные буквы или символы"));
    if (newPass !== confirmPass) return setError(t("Пароли не совпадают"));
    run(() => api("/auth/change-password", { method: "POST", body: { ticket: step.ticket, password: newPass } }));
  };

  const submitForgot = async () => {
    if (!validEmail(email)) return setError(t("Введите корректный email"));
    setBusy(true);
    setError("");
    try {
      await api("/auth/forgot", { method: "POST", body: { email } });
      go("sent");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (newPass.length < 10) return setError(t("Минимум 10 символов"));
    if (passwordScore(newPass) < 3) return setError(t("Пароль слишком простой — добавьте цифры, заглавные буквы или символы"));
    if (newPass !== confirmPass) return setError(t("Пароли не совпадают"));
    setBusy(true);
    setError("");
    try {
      await api("/auth/reset", { method: "POST", body: { token: resetToken, password: newPass } });
      window.history.replaceState(null, "", "/login");
      setNewPass("");
      setConfirmPass("");
      go("resetDone");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const backToLogin = () => {
    if (window.location.hash) window.history.replaceState(null, "", "/login");
    setPassword("");
    setNewPass("");
    setConfirmPass("");
    setStep({});
    go("login");
  };

  return (
    <div className="auth">
      <LangSwitch className="auth__lang" />
      <div className="auth__card">
        <aside className="auth__brand">
          <div className="auth__glow" />
          <div className="auth__logo">
            <img src={logoMark} alt="" />
            <div>
              PIKA<span>LEADS</span>
            </div>
          </div>
          <div>
            <h1 className="auth__headline">{t("Панель управления")}<br />{t("агентством")}</h1>
            <p className="auth__lead">{t("Заявки с сайта, статусы и команда — в одном защищённом рабочем пространстве.")}</p>
            <ul className="auth__features">
              <li>
                <span>✓</span>{t("Все заявки сайта с UTM-метками")}</li>
              <li>
                <span>✓</span>{t("Статусы синхронизированы с Telegram")}</li>
              <li>
                <span>✓</span>{t("Ролевой доступ и 2FA")}</li>
            </ul>
          </div>
          <div className="auth__copy">© {new Date().getFullYear()} Pikaleads · app.pika-leads.com</div>
        </aside>

        <main className="auth__form">
          {screen === "login" && (
            <div className="auth__screen">
              <h2 className="auth__title">{t("Вход в панель")}</h2>
              <p className="auth__text">{t("Введите данные учётной записи")}</p>

              <label className="field">
                <span className="field__label">Email</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={email}
                  autoFocus
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && submitLogin()}
                />
              </label>

              <div className="auth__row">
                <span className="field__label">{t("Пароль")}</span>
                <button type="button" className="auth__link" onClick={() => go("forgot")}>{t("Забыли пароль?")}</button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" onEnter={submitLogin} />
              </div>

              <ErrorAlert error={error} />

              <label className="auth__remember">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />{t("Запомнить меня на этом устройстве")}</label>

              <button type="button" className="btn btn--primary btn--block" onClick={submitLogin} disabled={busy}>
                {busy ? <span className="spinner" /> : t("Войти")}
              </button>

              <div className="auth__secure">
                <i />{t("Двухфакторная защита включена")}</div>
            </div>
          )}

          {screen === "twofa" && (
            <div className="auth__screen">
              <button type="button" className="auth__back" onClick={backToLogin}>{t("← Назад ко входу")}</button>
              <div className="auth__icon">
                <Icon name="shield" size={24} />
              </div>
              <h2 className="auth__title">{t("Подтверждение входа")}</h2>
              <p className="auth__text">{t("Введите 6-значный код из приложения-аутентификатора для")}{" "}<b>{step.email}</b>
              </p>
              <CodeInput value={code} onChange={setCode} onEnter={() => submitCode("/auth/2fa")} />
              <ErrorAlert error={error} />
              <button type="button" className="btn btn--primary btn--block" onClick={() => submitCode("/auth/2fa")} disabled={busy}>
                {busy ? <span className="spinner" /> : t("Подтвердить и войти")}
              </button>
              <p className="auth__text" style={{ marginTop: 18, marginBottom: 0, fontSize: 12 }}>{t("Нет доступа к телефону? Попросите администратора сбросить 2FA.")}</p>
            </div>
          )}

          {screen === "setup" && (
            <div className="auth__screen">
              <button type="button" className="auth__back" onClick={backToLogin}>{t("← Назад ко входу")}</button>
              <h2 className="auth__title">{t("Подключите 2FA")}</h2>
              <p className="auth__text">{t("Для доступа к панели нужна двухфакторная защита. Это займёт минуту.")}</p>
              <div className="auth__setup">
                <QrCode text={step.otpauth} size={150} />
                <ol className="auth__steps">
                  <li>{t("Установите Google Authenticator, 1Password или Authy")}</li>
                  <li>{t("Отсканируйте QR-код (или введите ключ ниже)")}</li>
                  <li>{t("Введите 6-значный код из приложения")}</li>
                </ol>
              </div>
              <div className="auth__secret">
                <span>{step.secret?.match(/.{1,4}/g)?.join(" ")}</span>
                <CopyButton value={step.secret || ""} label={t("Скопировать ключ")} />
              </div>
              <CodeInput value={code} onChange={setCode} onEnter={() => submitCode("/auth/2fa-setup")} autoFocus={false} />
              <ErrorAlert error={error} />
              <button type="button" className="btn btn--primary btn--block" onClick={() => submitCode("/auth/2fa-setup")} disabled={busy}>
                {busy ? <span className="spinner" /> : t("Включить 2FA и войти")}
              </button>
            </div>
          )}

          {screen === "change" && (
            <div className="auth__screen">
              <div className="auth__icon">
                <Icon name="lock" size={24} />
              </div>
              <h2 className="auth__title">{t("Новый пароль")}</h2>
              <p className="auth__text">{t("Вы вошли с временным паролем. Придумайте свой — его будете знать только вы.")}</p>

              <span className="field__label">{t("Новый пароль")}</span>
              <div style={{ marginTop: 7 }}>
                <PasswordInput
                  value={newPass}
                  onChange={setNewPass}
                  placeholder={t("Минимум 10 символов")}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <StrengthMeter password={newPass} />

              <label className="field">
                <span className="field__label">{t("Повторите пароль")}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("Повторите пароль")}
                  value={confirmPass}
                  onChange={(event) => setConfirmPass(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && submitNewPassword()}
                />
              </label>

              <ErrorAlert error={error} />
              <button type="button" className="btn btn--primary btn--block" onClick={submitNewPassword} disabled={busy}>
                {busy ? <span className="spinner" /> : t("Сохранить пароль")}
              </button>
            </div>
          )}

          {screen === "forgot" && (
            <div className="auth__screen">
              <button type="button" className="auth__back" onClick={backToLogin}>{t("← Назад ко входу")}</button>
              <div className="auth__icon">
                <Icon name="key" size={24} />
              </div>
              <h2 className="auth__title">{t("Сброс пароля")}</h2>
              {forgotAvailable === null && <div className="spinner" />}
              {forgotAvailable === false && (
                <>
                  <p className="auth__text">{t("Напишите администратору панели — он выдаст временный пароль в разделе «Команда». При входе с ним вы сразу зададите новый пароль.")}</p>
                  <button type="button" className="btn btn--block" onClick={backToLogin}>{t("Вернуться ко входу")}</button>
                </>
              )}
              {forgotAvailable && (
                <>
                  <p className="auth__text">{t("Введите email, с которым входите в панель, — пришлём ссылку для нового пароля.")}</p>
                  <label className="field">
                    <span className="field__label">Email</span>
                    <input
                      className="input"
                      type="email"
                      autoComplete="username"
                      placeholder="you@pika-leads.com"
                      value={email}
                      autoFocus
                      onChange={(event) => setEmail(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && submitForgot()}
                    />
                  </label>
                  <ErrorAlert error={error} />
                  <button type="button" className="btn btn--primary btn--block" onClick={submitForgot} disabled={busy}>
                    {busy ? <span className="spinner" /> : t("Отправить ссылку")}
                  </button>
                </>
              )}
            </div>
          )}

          {screen === "sent" && (
            <div className="auth__screen">
              <div className="auth__icon">
                <Icon name="mail" size={24} />
              </div>
              <h2 className="auth__title">{t("Проверьте почту")}</h2>
              <p className="auth__text">{t("Если")}{" "}<b>{email.trim()}</b>{" "}{t("есть в панели, на него придёт письмо со ссылкой. Она действует 30 минут. Письма нет — загляните в «Спам».")}</p>
              <button type="button" className="btn btn--block" onClick={backToLogin}>{t("Вернуться ко входу")}</button>
            </div>
          )}

          {screen === "reset" && (
            <div className="auth__screen">
              <div className="auth__icon">
                <Icon name="lock" size={24} />
              </div>
              <h2 className="auth__title">{t("Новый пароль")}</h2>
              <p className="auth__text">{t("Придумайте новый пароль. После сохранения все устройства выйдут из панели.")}</p>

              <span className="field__label">{t("Новый пароль")}</span>
              <div style={{ marginTop: 7 }}>
                <PasswordInput
                  value={newPass}
                  onChange={setNewPass}
                  placeholder={t("Минимум 10 символов")}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <StrengthMeter password={newPass} />

              <label className="field">
                <span className="field__label">{t("Повторите пароль")}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("Повторите пароль")}
                  value={confirmPass}
                  onChange={(event) => setConfirmPass(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && submitReset()}
                />
              </label>

              <ErrorAlert error={error} />
              <button type="button" className="btn btn--primary btn--block" onClick={submitReset} disabled={busy}>
                {busy ? <span className="spinner" /> : t("Сохранить пароль")}
              </button>
              <button type="button" className="auth__link auth__reset-back" onClick={backToLogin}>{t("Вспомнили пароль? Войти")}</button>
            </div>
          )}

          {screen === "resetDone" && (
            <div className="auth__screen auth__done">
              <div className="auth__done-icon">
                <Icon name="check" size={34} strokeWidth="2.6" />
              </div>
              <h2 className="auth__title">{t("Пароль изменён")}</h2>
              <p className="auth__text">{t("Войдите с новым паролем. Код 2FA понадобится как обычно.")}</p>
              <button type="button" className="btn btn--primary btn--block" onClick={backToLogin}>{t("Войти")}</button>
            </div>
          )}

          {screen === "success" && (
            <div className="auth__screen auth__done">
              <div className="auth__done-icon">
                <Icon name="check" size={34} strokeWidth="2.6" />
              </div>
              <h2 className="auth__title">{t("Вход выполнен")}</h2>
              <p className="auth__text">{t("Добро пожаловать,")}{" "}{step.user?.name}{t(". Открываем панель…")}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Login;
