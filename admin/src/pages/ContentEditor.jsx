import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Icon from "../components/Icon";
import { ErrorAlert } from "../components/ui";
import { SchemaForm, Toggle } from "../components/content/fields";
import BlockEditor from "../components/content/BlockEditor";
import { api } from "../lib/api";
import {
  LANGS,
  cleanBlocks,
  clearDraft,
  countMissing,
  dropMissingUploads,
  loadDraft,
  merge3,
  saveDraft,
  slugify,
  titleOf,
} from "../lib/content";
import { formatDate } from "../lib/format";
import { usePublish } from "../lib/publish";
import { articleSchema, caseSchema, emptyArticle, emptyCase } from "../content/schemas";

import "./Content.css";

const EDITORS = {
  cases: {
    schema: caseSchema,
    empty: emptyCase,
    listPath: "/cases",
    sitePath: (id) => `/cases/${id}`,
    noun: "кейс",
    newTitle: "Новый кейс",
  },
  articles: {
    schema: articleSchema,
    empty: emptyArticle,
    listPath: "/blog",
    sitePath: (id) => `/blog/${id}`,
    noun: "статью",
    newTitle: "Новая статья",
    bodies: true,
  },
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Ключі нових картинок, які ще використовуються в записі */
const usedUploads = (value, uploads) => {
  const text = JSON.stringify(value);
  return Object.fromEntries(Object.entries(uploads).filter(([key]) => text.includes(`"upload:${key}"`)));
};

const sitePrefix = (lang) => (lang === "uk" ? "" : `/${lang}`);

function ContentEditor({ collection }) {
  const config = EDITORS[collection];
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { published } = usePublish();
  const isNew = routeId === "new";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [item, setItem] = useState(null);
  const [sha, setSha] = useState(null);
  const [bodies, setBodies] = useState({});
  const [changedBodies, setChangedBodies] = useState([]);
  const [uploads, setUploads] = useState({});
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [siteUrl, setSiteUrl] = useState("https://pika-leads.com");
  const [lang, setLang] = useState("uk");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(null);
  // версія, з якої почали правити (для злиття чернетки з чужими змінами)
  const [base, setBase] = useState(null);

  const draftId = isNew ? "new" : routeId;

  // ---------- завантаження ----------
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setError("");
    setConflict(false);
    try {
      if (isNew) {
        const { next } = await api(`/content/${collection}/new`);
        const empty = config.empty();
        if (collection === "cases") {
          empty.number = String(next.number).padStart(2, "0");
          empty.originalId = next.originalId;
        }
        setItem(empty);
        setBase({ item: empty, bodies: {} });
        setSha(null);
        setBodies({ uk: { sha: null, blocks: [] }, en: null, ru: null });
        setChangedBodies(config.bodies ? ["uk"] : []);
        setSlug("");
        setSlugTouched(false);
      } else {
        const data = await api(`/content/${collection}/${routeId}`);
        setItem(data.item);
        setBase({ item: data.item, bodies: data.bodies || {} });
        setSha(data.sha);
        setBodies(data.bodies || {});
        setChangedBodies([]);
        setSiteUrl(data.siteUrl || "https://pika-leads.com");
      }
      setUploads({});
      setDirty(false);
      const saved = loadDraft(collection, draftId);
      setDraft(saved && saved.item ? saved : null);
    } catch (fetchError) {
      setLoadError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, [collection, config, draftId, isNew, routeId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- чернетка в браузері ----------
  useEffect(() => {
    if (!dirty || !item) return undefined;
    const timer = setTimeout(() => {
      const payload = { item, bodies, changedBodies, slug: slugTouched ? slug : "", baseSha: sha, base };
      // великі картинки можуть не влізти в localStorage — тоді без них
      if (!saveDraft(collection, draftId, { ...payload, uploads })) saveDraft(collection, draftId, payload);
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty, item, bodies, changedBodies, slug, slugTouched, sha, base, uploads, collection, draftId]);

  const restoreDraft = () => {
    const restoredUploads = draft.uploads || {};
    // свої правки накладаємо на актуальну версію (чужі зміни в інших полях зберігаються)
    let nextItem = draft.base ? merge3(draft.base.item, draft.item, item) : draft.item;
    const nextBodies = { ...bodies };
    for (const language of draft.changedBodies || []) {
      const mine = draft.bodies?.[language];
      const theirs = bodies[language];
      if (!mine) continue;
      if (mine.deleted) {
        nextBodies[language] = theirs ? { sha: theirs.sha, deleted: true } : null;
        continue;
      }
      const baseBlocks = draft.base?.bodies?.[language]?.blocks;
      const blocks = baseBlocks && theirs?.blocks ? merge3(baseBlocks, mine.blocks, theirs.blocks) : mine.blocks;
      nextBodies[language] = { sha: theirs?.sha ?? null, blocks };
    }
    const checkedItem = dropMissingUploads(nextItem, restoredUploads);
    const checkedBodies = dropMissingUploads(nextBodies, restoredUploads);
    nextItem = checkedItem.value;

    setItem(nextItem);
    setBodies(checkedBodies.value);
    setChangedBodies(draft.changedBodies || []);
    setUploads(restoredUploads);
    if (isNew && draft.slug) {
      setSlug(draft.slug);
      setSlugTouched(true);
    }
    setDirty(true);
    setDraft(null);
    if (checkedItem.dropped + checkedBodies.dropped > 0) {
      setNotice("");
      setError("Часть новых картинок не сохранилась в черновике (слишком большие) — загрузите их ещё раз.");
    }
  };

  const discardDraft = () => {
    clearDraft(collection, draftId);
    setDraft(null);
  };

  // попередження при закритті вкладки / переході з незбереженими правками
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---------- зміни ----------
  // fn(prev) → next (див. fields.jsx)
  const change = (fn) => {
    setItem((prev) => fn(prev));
    setDirty(true);
    setNotice("");
  };

  const changeBody = (language, fn) => {
    setBodies((prev) => {
      const current = prev[language];
      const blocks = fn(current && !current.deleted ? current.blocks : []);
      return { ...prev, [language]: { sha: current?.sha ?? null, blocks } };
    });
    setChangedBodies((prev) => (prev.includes(language) ? prev : [...prev, language]));
    setDirty(true);
    setNotice("");
  };

  const removeBody = (language) => {
    if (!window.confirm(`Удалить ${language.toUpperCase()}-текст статьи? На сайте будет показан украинский текст с пометкой.`)) return;
    setBodies((prev) => ({ ...prev, [language]: prev[language]?.sha ? { sha: prev[language].sha, deleted: true } : null }));
    setChangedBodies((prev) => (prev.includes(language) ? prev : [...prev, language]));
    setDirty(true);
  };

  const ctx = useMemo(
    () => ({
      lang,
      uploads,
      onUpload: (key, dataUrl) => setUploads((prev) => ({ ...prev, [key]: dataUrl })),
    }),
    [lang, uploads],
  );

  // адреса нового запису: з назви, доки не змінили вручну
  const newSlug = slugTouched ? slug : slugify(titleOf(item));

  const missing = useMemo(() => {
    if (!item) return {};
    return Object.fromEntries(LANGS.map(({ code }) => [code, code === "uk" ? 0 : countMissing(item, code)]));
  }, [item]);

  // ---------- збереження ----------
  const save = async () => {
    setError("");
    setNotice("");
    setConflict(false);
    const id = isNew ? newSlug : routeId;
    if (!titleOf(item).trim()) {
      setLang("uk");
      setError(collection === "cases" ? "Заполните название кейса (UA)" : "Заполните заголовок (UA)");
      return;
    }
    if (isNew && !SLUG.test(id)) {
      setError("Адрес страницы: латиница в нижнем регистре, цифры и дефисы (например, shoe-store-meta)");
      return;
    }

    const payload = { item, sha };
    if (config.bodies) {
      payload.bodies = {};
      for (const language of changedBodies) {
        const body = bodies[language];
        if (!body) continue;
        payload.bodies[language] = body.deleted ? { delete: true, sha: body.sha } : { sha: body.sha, blocks: cleanBlocks(body.blocks) };
      }
    }
    payload.uploads = usedUploads({ item: payload.item, bodies: payload.bodies }, uploads);

    setSaving(true);
    try {
      const data = await api(`/content/${collection}/${id}`, { method: "PUT", body: payload });
      clearDraft(collection, draftId);
      setItem(data.item);
      setBase({ item: data.item, bodies: data.bodies || {} });
      setSha(data.sha);
      setBodies(data.bodies || {});
      setChangedBodies([]);
      setUploads({});
      setDirty(false);
      published(data.commit);
      setNotice(
        data.commit?.unchanged
          ? "Изменений нет — сохранять нечего."
          : data.item.status === "draft"
            ? "Сохранено как черновик. На сайте не показывается."
            : "Сохранено. Сайт обновится через 2–3 минуты.",
      );
      if (isNew) navigate(`${config.listPath}/${id}`, { replace: true });
    } catch (saveError) {
      setError(saveError.message);
      if (saveError.status === 409 && !isNew) setConflict(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const name = titleOf(item) || routeId;
    if (!window.confirm(`Удалить ${config.noun} «${name}» с сайта? Его можно будет восстановить только из истории GitHub.`)) return;
    setSaving(true);
    try {
      const { commit } = await api(`/content/${collection}/${routeId}?sha=${sha}`, { method: "DELETE" });
      clearDraft(collection, draftId);
      setDirty(false);
      published(commit);
      navigate(config.listPath, { replace: true, state: { notice: `Удалено: «${name}». Сайт обновится через 2–3 минуты.` } });
    } catch (deleteError) {
      setError(deleteError.message);
      setSaving(false);
    }
  };

  // ---------- розмітка ----------
  if (loading) {
    return (
      <div className="content-loading">
        <div className="spinner" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="content-page">
        <Link to={config.listPath} className="back-link">
          ← Назад
        </Link>
        <ErrorAlert error={loadError} />
        <button type="button" className="btn" onClick={load}>
          Повторить
        </button>
      </div>
    );
  }

  const isDraft = item.status === "draft";
  const currentBody = bodies[lang] && !bodies[lang].deleted ? bodies[lang] : null;

  return (
    <div className="content-page editor">
      <div className="editor__bar">
        <div className="editor__bar-main">
          <Link to={config.listPath} className="back-link">
            ← {collection === "cases" ? "Кейсы" : "Блог"}
          </Link>
          <h1 className="editor__title">{titleOf(item) || config.newTitle}</h1>
        </div>
        <div className="editor__bar-actions">
          <div className="lang-tabs" role="tablist">
            {LANGS.map(({ code, label }) => {
              const count = missing[code] + (config.bodies && code !== "uk" && (!bodies[code] || bodies[code].deleted) ? 1 : 0);
              return (
                <button
                  type="button"
                  key={code}
                  role="tab"
                  aria-selected={lang === code}
                  className={lang === code ? "is-active" : ""}
                  onClick={() => setLang(code)}
                  title={count ? `Не переведено: ${count}` : ""}
                >
                  {label}
                  {count > 0 && <span className="lang-tabs__count">{count}</span>}
                </button>
              );
            })}
          </div>
          <Toggle
            checked={!isDraft}
            onChange={(checked) => change((prev) => ({ ...prev, status: checked ? undefined : "draft" }))}
            label={isDraft ? "Черновик" : "Опубликован"}
          />
          <button type="button" className="btn btn--primary" onClick={save} disabled={saving || (!dirty && !isNew)}>
            {saving ? <span className="spinner spinner--dark" /> : <Icon name="check" />}
            {saving ? "Сохраняем…" : dirty || isNew ? "Сохранить" : "Сохранено"}
          </button>
        </div>
      </div>

      {draft && (
        <div className="alert alert--info">
          <span>
            Есть несохранённые правки от {formatDate(new Date(draft.savedAt).toISOString())}
            {draft.baseSha !== sha && !isNew ? " (запись с тех пор изменили — проверьте после восстановления)" : ""}.
          </span>
          <span className="alert__actions">
            <button type="button" className="btn btn--sm" onClick={restoreDraft}>
              Восстановить
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={discardDraft}>
              Отбросить
            </button>
          </span>
        </div>
      )}
      {notice && <div className="alert alert--ok">✓ {notice}</div>}
      {error && (
        <div className="alert">
          <span>⚠ {error}</span>
          {conflict && (
            <span className="alert__actions">
              <button type="button" className="btn btn--sm" onClick={load}>
                Загрузить свежую версию
              </button>
            </span>
          )}
        </div>
      )}

      {lang !== "uk" && (
        <div className="lang-hint">
          Режим перевода {lang.toUpperCase()}: пустые поля на сайте показываются на украинском. Подсказка в поле — украинский текст, кнопка
          «UA → {lang.toUpperCase()}» копирует его. Картинки, цвета и настройки — общие для всех языков.
        </div>
      )}

      {/* поки йде збереження — форма лише для читання (інакше правки загубились би) */}
      <fieldset className="editor__form" disabled={saving}>
        <section className="form-section card">
          <div className="form-section__body">
            <div className="schema-field">
              <div className="field__label">Адрес страницы</div>
              {isNew ? (
                <div className="slug-field">
                  <span className="mono faint">{config.sitePath("")}</span>
                  <input
                    className="input mono"
                    value={newSlug}
                    placeholder="shoe-store-meta"
                    onChange={(event) => {
                      setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                      setSlugTouched(true);
                    }}
                  />
                </div>
              ) : (
                <div className="slug-field">
                  <span className="mono">{config.sitePath(routeId)}</span>
                  {!isDraft && (
                    <a
                      className="btn btn--sm btn--ghost"
                      href={`${siteUrl}${sitePrefix(lang)}${config.sitePath(routeId)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <Icon name="external" /> Открыть на сайте
                    </a>
                  )}
                  <Link className="btn btn--sm btn--ghost" to={`/seo?path=${encodeURIComponent(config.sitePath(routeId))}`}>
                    <Icon name="search" /> SEO в Google
                  </Link>
                </div>
              )}
              <div className="schema-field__hint">
                {isNew ? "Создаётся из названия. После сохранения изменить нельзя." : "Адрес не меняется, чтобы не ломать ссылки."}
              </div>
            </div>
          </div>
        </section>

        <SchemaForm schema={config.schema} item={item} onChange={change} ctx={ctx} compact={!isNew} />

        {config.bodies && (
          <section className="form-section card">
            <div className="form-section__head form-section__head--static">
              <h2>Текст статьи · {lang === "uk" ? "UA" : lang.toUpperCase()}</h2>
              {lang !== "uk" && currentBody && (
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => removeBody(lang)}>
                  Удалить перевод
                </button>
              )}
            </div>
            <div className="form-section__body">
              {currentBody ? (
                <BlockEditor
                  blocks={currentBody.blocks}
                  onChange={(fn) => changeBody(lang, fn)}
                  uploads={uploads}
                  onUpload={ctx.onUpload}
                />
              ) : (
                <div className="empty-body">
                  <p>Перевода текста нет — на сайте показывается украинский текст с пометкой «статья пока не переведена».</p>
                  <div className="empty-body__actions">
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => changeBody(lang, () => JSON.parse(JSON.stringify(bodies.uk?.blocks || [])))}
                    >
                      Скопировать украинский текст и перевести
                    </button>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => changeBody(lang, () => [])}>
                      Начать с пустого
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </fieldset>

      {!isNew && (
        <div className="editor__danger">
          <button type="button" className="btn btn--danger btn--sm" onClick={remove} disabled={saving}>
            <Icon name="trash" /> Удалить {config.noun}
          </button>
        </div>
      )}
    </div>
  );
}

export default ContentEditor;
