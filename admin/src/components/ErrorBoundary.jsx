import { Component } from "react";
import { t } from "../lib/i18n";

/** Якщо щось у розділі зламалося — показуємо повідомлення замість порожнього екрана */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" style={{ padding: 24, maxWidth: 560 }}>
        <h2 className="modal__title">{t("Не удалось показать раздел")}</h2>
        <p className="muted">{t("Обновите страницу. Если ошибка повторяется — сообщите администратору.")}</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>{t("Обновить")}</button>
      </div>
    );
  }
}

export default ErrorBoundary;
