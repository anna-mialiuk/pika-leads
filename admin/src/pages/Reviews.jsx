import { useEffect, useMemo, useState } from "react";

import Icon from "../components/Icon";
import { ErrorAlert, Modal } from "../components/ui";
import { SchemaForm, Toggle } from "../components/content/fields";
import { OrderList } from "./ContentList";
import { api } from "../lib/api";
import { LANGS, countMissing, locText } from "../lib/content";
import { usePublish } from "../lib/publish";
import { emptyReview, reviewSchema } from "../content/schemas";

import "./Content.css";
import { t } from "../lib/i18n";

/** Редагування одного відгуку у вікні */
function ReviewModal({ entry, onClose, onSaved, onDeleted }) {
  const isNew = !entry.sha;
  const { published } = usePublish();
  const [item, setItem] = useState(entry.item);
  const [lang, setLang] = useState("uk");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ctx = useMemo(() => ({ lang, uploads: {}, onUpload: () => {} }), [lang]);

  const close = () => {
    if (dirty && !window.confirm(t("Закрыть без сохранения?"))) return;
    onClose();
  };

  const save = async () => {
    if (!locText(item.text, "uk").trim() || !locText(item.name, "uk").trim()) {
      setLang("uk");
      setError(t("Заполните имя и текст отзыва (UA)"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await api(`/content/reviews/${entry.id}`, { method: "PUT", body: { item, sha: entry.sha || null } });
      published(data.commit);
      onSaved(data.item.status === "draft" ? t("Отзыв сохранён как черновик.") : t("Отзыв сохранён. Сайт обновится через 2–3 минуты."));
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("Удалить отзыв с сайта?"))) return;
    setSaving(true);
    try {
      const { commit } = await api(`/content/reviews/${entry.id}?sha=${entry.sha}`, { method: "DELETE" });
      published(commit);
      onDeleted();
    } catch (deleteError) {
      setError(deleteError.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isNew ? t("Новый отзыв") : t("Отзыв")} onClose={close} wide>
      <div className="review-modal__bar">
        <div className="lang-tabs">
          {LANGS.map(({ code, label }) => {
            const count = code === "uk" ? 0 : countMissing(item, code);
            return (
              <button type="button" key={code} className={lang === code ? "is-active" : ""} onClick={() => setLang(code)}>
                {label}
                {count > 0 && <span className="lang-tabs__count">{count}</span>}
              </button>
            );
          })}
        </div>
        <Toggle
          checked={item.status !== "draft"}
          onChange={(checked) => {
            setItem({ ...item, status: checked ? undefined : "draft" });
            setDirty(true);
          }}
          label={item.status === "draft" ? t("Черновик") : t("Опубликован")}
        />
      </div>
      <ErrorAlert error={error} />
      <div className="review-modal__form">
        <SchemaForm
          schema={reviewSchema}
          item={item}
          ctx={ctx}
          onChange={(next) => {
            setItem(next);
            setDirty(true);
          }}
        />
      </div>
      <div className="modal__actions">
        {!isNew && (
          <button type="button" className="btn btn--danger btn--sm" onClick={remove} disabled={saving}>
            <Icon name="trash" />{" "}{t("Удалить")}</button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn--ghost" onClick={close} disabled={saving}>{t("Отмена")}</button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving || (!dirty && !isNew)}>
          {saving ? t("Сохраняем…") : t("Сохранить")}
        </button>
      </div>
    </Modal>
  );
}

function Reviews() {
  const { published } = usePublish();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [ordering, setOrdering] = useState(false);

  const load = () =>
    api("/content/reviews")
      .then(({ items: list }) => setItems(list))
      .catch((loadError) => setError(loadError.message));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    try {
      const { next } = await api("/content/reviews/new");
      setEditing({ id: next.id, sha: null, item: emptyReview() });
    } catch (createError) {
      setError(createError.message);
    }
  };

  const done = (message) => {
    setEditing(null);
    setNotice(message);
    load();
  };

  return (
    <div className="content-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("Отзывы")}{" "}{items && <span className="faint">{items.length}</span>}</h1>
          <p className="page-text">{t("Отзывы клиентов на главной и страницах услуг.")}</p>
        </div>
        <div className="leads__head-actions">
          {items && !ordering && (
            <button type="button" className="btn" onClick={() => setOrdering(true)}>
              <Icon name="sort" />{" "}{t("Порядок")}</button>
          )}
          <button type="button" className="btn btn--primary" onClick={create}>
            <Icon name="plus" />{" "}{t("Новый отзыв")}</button>
        </div>
      </div>

      {notice && <div className="alert alert--ok">✓ {notice}</div>}
      <ErrorAlert error={error} />
      {!items && !error && (
        <div className="content-loading">
          <div className="spinner" />
        </div>
      )}

      {items && ordering && (
        <OrderList
          items={items.map((r) => ({ ...r, title: `${locText(r.item.name, "uk")} — ${locText(r.item.text, "uk").slice(0, 70)}…` }))}
          onCancel={() => setOrdering(false)}
          onSave={async (ids) => {
            try {
              const { commit } = await api("/content/reviews/order", { method: "POST", body: { ids } });
              published(commit);
              setOrdering(false);
              setNotice(t("Порядок сохранён. Сайт обновится через 2–3 минуты."));
              load();
            } catch (orderError) {
              setError(orderError.message);
            }
          }}
        />
      )}

      {items && !ordering && (
        <div className="review-grid">
          {items.map((entry) => (
            <button type="button" key={entry.id} className="review-card card" onClick={() => setEditing(entry)}>
              <div className="review-card__head">
                <span className="review-card__avatar">{locText(entry.item.initials, "uk")}</span>
                <span>
                  <strong>{locText(entry.item.name, "uk")}</strong>
                  <small className="faint">{locText(entry.item.category, "uk")}</small>
                </span>
              </div>
              <p className="review-card__text">{locText(entry.item.text, "uk")}</p>
              <div className="content-card__flags">
                {entry.status === "draft" && <span className="chip chip--draft">{t("Черновик")}</span>}
                {locText(entry.item.badge, "uk") && <span className="chip">{locText(entry.item.badge, "uk")}</span>}
                {["en", "ru"].map((lang) => (
                  <span key={lang} className={`chip ${entry.translated[lang] ? "chip--ok" : "chip--muted"}`}>
                    {lang.toUpperCase()} {entry.translated[lang] ? "✓" : "…"}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <ReviewModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={done}
          onDeleted={() => done(t("Отзыв удалён. Сайт обновится через 2–3 минуты."))}
        />
      )}
    </div>
  );
}

export default Reviews;
