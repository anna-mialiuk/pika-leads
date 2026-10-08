import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import Icon from "../components/Icon";
import { ErrorAlert } from "../components/ui";
import { api } from "../lib/api";
import { imageUrl } from "../lib/content";
import { usePublish } from "../lib/publish";
import { CASE_SOURCES } from "../content/schemas";

import "./Content.css";

const LISTS = {
  cases: {
    title: "Кейсы",
    text: "Кейсы на сайте: карточки, страницы кейсов, блоки на главной и страницах услуг.",
    add: "Новый кейс",
    path: "/cases",
  },
  articles: {
    title: "Блог",
    text: "Статьи блога: карточка, обложка и текст на трёх языках.",
    add: "Новая статья",
    path: "/blog",
  },
};

const SOURCE_LABEL = Object.fromEntries(CASE_SOURCES.map((s) => [s.value, s.label]));

function Flags({ item }) {
  return (
    <div className="content-card__flags">
      {item.status === "draft" && <span className="chip chip--draft">Черновик</span>}
      {item.public === false && item.status !== "draft" && (
        <span className="chip chip--warn" title="Без обложки кейс не показывается в списке кейсов">
          Без обложки
        </span>
      )}
      {item.featured && <span className="chip chip--accent">★ На главной</span>}
      {["en", "ru"].map((lang) => {
        const ok = item.translated?.[lang] && (!item.bodies || item.bodies[lang]);
        return (
          <span key={lang} className={`chip ${ok ? "chip--ok" : "chip--muted"}`} title={ok ? "Переведено" : "Есть непереведённые поля"}>
            {lang.toUpperCase()} {ok ? "✓" : "…"}
          </span>
        );
      })}
    </div>
  );
}

/** Режим «порядок»: перетягування або стрілки */
export function OrderList({ items, onSave, onCancel }) {
  const [list, setList] = useState(items);
  const [dragIndex, setDragIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const move = (from, to) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setList(next);
  };
  return (
    <div className="order-list card">
      <div className="order-list__head">
        <span className="muted">Перетащите строки или используйте стрелки. Сверху — первые на сайте.</span>
        <div className="order-list__actions">
          <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel} disabled={saving}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(list.map((item) => item.id));
              setSaving(false);
            }}
          >
            {saving ? "Сохраняем…" : "Сохранить порядок"}
          </button>
        </div>
      </div>
      {list.map((item, index) => (
        <div
          key={item.id}
          className={`order-row ${dragIndex === index ? "is-dragging" : ""}`}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", String(index));
            event.dataTransfer.effectAllowed = "move";
            setDragIndex(index);
          }}
          onDragEnd={() => setDragIndex(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            move(Number(event.dataTransfer.getData("text/plain")), index);
            setDragIndex(null);
          }}
        >
          <span className="order-row__grip" aria-hidden="true">
            <Icon name="grip" />
          </span>
          <span className="order-row__num mono">{index + 1}</span>
          {item.image ? <img src={imageUrl(item.image)} alt="" loading="lazy" /> : <span className="order-row__noimg" />}
          <span className="order-row__title">{item.title || item.id}</span>
          {item.status === "draft" && <span className="chip chip--draft">Черновик</span>}
          <span className="order-row__arrows">
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => move(index, index - 1)}
              disabled={index === 0}
              aria-label="Выше"
            >
              <Icon name="up" />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => move(index, index + 1)}
              disabled={index === list.length - 1}
              aria-label="Ниже"
            >
              <Icon name="down" />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function ContentList({ collection }) {
  const config = LISTS[collection];
  const location = useLocation();
  const { published } = usePublish();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [ordering, setOrdering] = useState(false);

  const load = () =>
    api(`/content/${collection}`)
      .then(({ items: list }) => {
        setItems(list);
        setError("");
      })
      .catch((loadError) => setError(loadError.message));

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (source === "all" || item.source === source) &&
        (status === "all" || item.status === status || (status === "untranslated" && !(item.translated.en && item.translated.ru))) &&
        (!query || `${item.title} ${item.id} ${item.category}`.toLowerCase().includes(query)),
    );
  }, [items, search, source, status]);

  const saveOrder = async (ids) => {
    try {
      const { commit } = await api(`/content/${collection}/order`, { method: "POST", body: { ids } });
      published(commit);
      setNotice("Порядок сохранён. Сайт обновится через 2–3 минуты.");
      setOrdering(false);
      load();
    } catch (orderError) {
      setError(orderError.message);
    }
  };

  return (
    <div className="content-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {config.title} {items && <span className="faint">{items.length}</span>}
          </h1>
          <p className="page-text">{config.text}</p>
        </div>
        <div className="leads__head-actions">
          {items && !ordering && (
            <button type="button" className="btn" onClick={() => setOrdering(true)}>
              <Icon name="sort" /> Порядок
            </button>
          )}
          <Link to={`${config.path}/new`} className="btn btn--primary">
            <Icon name="plus" /> {config.add}
          </Link>
        </div>
      </div>

      {notice && <div className="alert alert--ok">✓ {notice}</div>}
      <ErrorAlert error={error} />

      {!items && !error && (
        <div className="content-loading">
          <div className="spinner" />
        </div>
      )}

      {items && ordering && <OrderList items={items} onSave={saveOrder} onCancel={() => setOrdering(false)} />}

      {items && !ordering && (
        <>
          <div className="leads__filters">
            <div className="leads__search">
              <Icon name="search" />
              <input
                className="input input--sm"
                placeholder="Поиск по названию"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {collection === "cases" && (
              <select className="select select--sm" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="all">Все источники</option>
                {CASE_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            <select className="select select--sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Все</option>
              <option value="published">Опубликованные</option>
              <option value="draft">Черновики</option>
              <option value="untranslated">С непереведёнными полями</option>
            </select>
          </div>

          {filtered.length === 0 && <div className="leads__empty">Ничего не найдено</div>}

          <div className="content-grid">
            {filtered.map((item) => (
              <Link key={item.id} to={`${config.path}/${item.id}`} className="content-card card">
                <div className="content-card__image">
                  {item.image ? <img src={imageUrl(item.image)} alt="" loading="lazy" /> : <span>Нет обложки</span>}
                </div>
                <div className="content-card__body">
                  <div className="content-card__meta">
                    {item.category && (
                      <span className="content-card__category" style={{ "--cat": item.categoryColor || "var(--accent)" }}>
                        {item.category}
                      </span>
                    )}
                    {item.source && <span className="faint">{SOURCE_LABEL[item.source] || item.source}</span>}
                    {item.date && <span className="faint">{item.date.split("-").reverse().join(".")}</span>}
                  </div>
                  <h3 className="content-card__title">{item.title || item.id}</h3>
                  {item.metrics?.length > 0 && (
                    <div className="content-card__metrics">
                      {item.metrics.map((m, i) => (
                        <span key={i}>
                          <b>{m.value}</b> {m.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <Flags item={item} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ContentList;
