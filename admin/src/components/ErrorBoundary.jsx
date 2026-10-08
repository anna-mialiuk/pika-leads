import { Component } from "react";

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
        <h2 className="modal__title">Не удалось показать раздел</h2>
        <p className="muted">Обновите страницу. Если ошибка повторяется — сообщите администратору.</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
