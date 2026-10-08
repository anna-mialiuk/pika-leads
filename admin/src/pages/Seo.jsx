import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Icon from "../components/Icon";
import { ErrorAlert, Modal } from "../components/ui";
import { Toggle } from "../components/content/fields";
import { api } from "../lib/api";
import { LANGS } from "../lib/content";
import { timeAgo } from "../lib/format";
import { usePublish } from "../lib/publish";

import "./Content.css";
import "./Seo.css";

// Рекомендовані довжини (Google обрізає довше)
const TITLE = { min: 20, max: 60 };
const DESC = { min: 70, max: 160 };

const LANG_PREFIX = { en: "/en", ru: "/ru" };

/** https://pika-leads.com/en/cases/x → { lang: "en", path: "/cases/x" } */
function splitUrl(url, siteUrl) {
  let rest = url.startsWith(siteUrl) ? url.slice(siteUrl.length) || "/" : url;
  let lang = "uk";
  for (const [code, prefix] of Object.entries(LANG_PREFIX)) {
    if (rest === prefix || rest.startsWith(`${prefix}/`)) {
      lang = code;
      rest = rest.slice(prefix.length) || "/";
    }
  }
  return { lang, path: rest };
}

const TYPES = [
  { key: "main", label: "Основные", test: (p) => !/^\/(cases|blog|services)\/./.test(p) && !LEGAL.has(p) },
  { key: "services", label: "Услуги", test: (p) => p.startsWith("/services/") },
  { key: "cases", label: "Кейсы", test: (p) => p.startsWith("/cases/") },
  { key: "blog", label: "Блог", test: (p) => p.startsWith("/blog/") },
  { key: "legal", label: "Юридические", test: (p) => LEGAL.has(p) },
];
const LEGAL = new Set(["/privacy-policy", "/cookies-policy", "/disclaimer", "/personal-data"]);
const PAGE_NAMES = { "/": "Главная", "/cases": "Кейсы (список)", "/blog": "Блог (список)", "/team": "Команда", "/contacts": "Контакты" };

/** Проблеми сторінки однією мовою */
function issuesOf(page, duplicates) {
  if (!page) return [{ level: "bad", text: "Нет в sitemap" }];
  if (page.error) return [{ level: "bad", text: `Не открылась: ${page.error}` }];
  const list = [];
  const t = page.title?.length || 0;
  const d = page.description?.length || 0;
  if (!t) list.push({ level: "bad", text: "Нет заголовка" });
  else if (t > TITLE.max) list.push({ level: "warn", text: `Заголовок длинный (${t}) — Google обрежет` });
  else if (t < TITLE.min) list.push({ level: "warn", text: `Заголовок короткий (${t})` });
  if (!d) list.push({ level: "bad", text: "Нет описания" });
  else if (d > DESC.max) list.push({ level: "warn", text: `Описание длинное (${d}) — Google обрежет` });
  else if (d < DESC.min) list.push({ level: "warn", text: `Описание короткое (${d})` });
  if (page.title && duplicates.has(page.title)) list.push({ level: "warn", text: "Такой же заголовок у другой страницы" });
  if (page.h1 === 0) list.push({ level: "warn", text: "Нет заголовка H1" });
  if (page.h1 > 1) list.push({ level: "warn", text: `Несколько H1 (${page.h1})` });
  if (/noindex/.test(page.robots || "")) list.push({ level: "info", text: "Закрыта от индексации" });
  return list;
}

const levelOf = (issues) =>
  issues.some((i) => i.level === "bad") ? "bad" : issues.some((i) => i.level === "warn") ? "warn" : issues.length ? "info" : "ok";

/** Як сторінка виглядатиме в Google */
function GooglePreview({ url, title, description }) {
  const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
  return (
    <div className="serp">
      <div className="serp__site">
        <span className="serp__favicon">P</span>
        <span>
          <b>Pika Leads</b>
          <small>{url.replace(/^https?:\/\//, "")}</small>
        </span>
      </div>
      <div className="serp__title">{cut(title || "Без заголовка", 62)}</div>
      <div className="serp__desc">{cut(description || "Описания нет — Google возьмёт случайный кусок текста со страницы.", 160)}</div>
    </div>
  );
}

function Counter({ value, limits }) {
  const n = value.length;
  const level = !n ? "" : n > limits.max ? "bad" : n < limits.min ? "warn" : "ok";
  return (
    <span className={`counter counter--${level}`}>
      {n} / {limits.max}
    </span>
  );
}

function SeoModal({ row, siteUrl, override, onClose, onSaved }) {
  const { published } = usePublish();
  const [lang, setLang] = useState("uk");
  const [entry, setEntry] = useState(() => override || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const live = row.langs[lang];
  const text = (key) => entry[key]?.[lang] ?? "";
  const set = (key, value) =>
    setEntry((prev) => {
      const next = { ...(prev[key] || {}), [lang]: value };
      if (!value) delete next[lang];
      return { ...prev, [key]: next };
    });
  const pageUrl = `${siteUrl}${lang === "uk" ? "" : LANG_PREFIX[lang]}${row.path === "/" && lang !== "uk" ? "" : row.path}`;

  const save = async (reset = false) => {
    setSaving(true);
    setError("");
    try {
      const data = await api("/content/seo", {
        method: "PUT",
        body: { path: row.path, entry: reset ? null : entry, before: override || null },
      });
      published(data.commit);
      onSaved(row.path, data.entry);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={row.name} onClose={onClose} wide>
      <div className="seo-modal__path mono">{row.path}</div>
      <div className="review-modal__bar">
        <div className="lang-tabs">
          {LANGS.map(({ code, label }) => (
            <button type="button" key={code} className={lang === code ? "is-active" : ""} onClick={() => setLang(code)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ErrorAlert error={error} />

      <div className="seo-modal__grid">
        <div>
          <div className="schema-field">
            <div className="field__label seo-modal__label">
              Заголовок в Google <Counter value={text("title") || live?.title || ""} limits={TITLE} />
            </div>
            <input className="input" value={text("title")} placeholder={live?.title || ""} onChange={(e) => set("title", e.target.value)} />
            <div className="schema-field__hint">
              Пусто — как сейчас на сайте (серым). Пишется целиком, «| Pika Leads» само не добавляется.
            </div>
          </div>
          <div className="schema-field">
            <div className="field__label seo-modal__label">
              Описание <Counter value={text("description") || live?.description || ""} limits={DESC} />
            </div>
            <textarea
              className="textarea"
              rows={4}
              value={text("description")}
              placeholder={live?.description || ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <Toggle
            checked={entry.noindex}
            onChange={(checked) => setEntry((prev) => ({ ...prev, noindex: checked || undefined }))}
            label="Скрыть от поисковиков (noindex, все языки)"
          />
        </div>
        <div>
          <div className="field__label">Так будет в Google</div>
          <GooglePreview url={pageUrl} title={text("title") || live?.title} description={text("description") || live?.description} />
          {live?.issues?.length > 0 && (
            <ul className="seo-issues">
              {live.issues.map((issue) => (
                <li key={issue.text} className={`seo-issues__${issue.level}`}>
                  {issue.text}
                </li>
              ))}
            </ul>
          )}
          <a className="btn btn--sm btn--ghost" href={pageUrl} target="_blank" rel="noreferrer noopener">
            <Icon name="external" /> Открыть страницу
          </a>
        </div>
      </div>

      <div className="modal__actions">
        {override && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => save(true)} disabled={saving}>
            Сбросить к тексту сайта
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
          Отмена
        </button>
        <button type="button" className="btn btn--primary" onClick={() => save(false)} disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function Seo() {
  const [params, setParams] = useSearchParams();
  const [audit, setAudit] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("all");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [search, setSearch] = useState("");
  const [changed, setChanged] = useState(() => new Set());

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const [auditData, seo] = await Promise.all([api(`/content/seo/audit${refresh ? "?refresh=1" : ""}`), api("/content/seo")]);
      setAudit(auditData);
      setOverrides(seo.data || {});
      if (refresh) setChanged(new Set());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!audit) return [];
    const byLang = { uk: [], en: [], ru: [] };
    const byPath = new Map();
    for (const page of audit.pages) {
      const { lang, path } = splitUrl(page.url, audit.siteUrl);
      if (!byPath.has(path)) byPath.set(path, {});
      byPath.get(path)[lang] = page;
      byLang[lang]?.push(page);
    }
    // однакові заголовки в межах мови
    const dupes = {};
    for (const [lang, pages] of Object.entries(byLang)) {
      const count = new Map();
      for (const p of pages) if (p.title) count.set(p.title, (count.get(p.title) || 0) + 1);
      dupes[lang] = new Set([...count].filter(([, n]) => n > 1).map(([t]) => t));
    }
    return [...byPath]
      .map(([path, pages]) => {
        const langs = {};
        for (const { code } of LANGS) {
          const page = pages[code];
          langs[code] = page ? { ...page, issues: issuesOf(page, dupes[code]) } : { issues: issuesOf(null) };
        }
        const typeDef = TYPES.find((t) => t.test(path));
        return {
          path,
          type: typeDef?.key || "main",
          typeLabel: typeDef?.label,
          name: PAGE_NAMES[path] || pages.uk?.title?.replace(/\s*\|\s*Pika Leads$/, "") || path,
          langs,
          level: ["bad", "warn", "info", "ok"].find((lvl) => Object.values(langs).some((l) => levelOf(l.issues) === lvl)),
        };
      })
      .sort((a, b) => TYPES.findIndex((t) => t.key === a.type) - TYPES.findIndex((t) => t.key === b.type) || a.path.localeCompare(b.path));
  }, [audit]);

  const filtered = rows.filter(
    (row) =>
      (type === "all" || row.type === type) &&
      (!onlyIssues || row.level === "bad" || row.level === "warn") &&
      (!search || `${row.path} ${row.name}`.toLowerCase().includes(search.toLowerCase())),
  );
  const withIssues = rows.filter((r) => r.level === "bad" || r.level === "warn").length;

  const openPath = params.get("path");
  const openRow = openPath ? rows.find((r) => r.path === openPath) : null;
  const open = (path) => setParams(path ? { path } : {});

  return (
    <div className="content-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">SEO</h1>
          <p className="page-text">Заголовки и описания страниц в Google. Проверка — по живому сайту.</p>
        </div>
        <button type="button" className="btn" onClick={() => load(true)} disabled={loading}>
          {loading ? <span className="spinner" /> : <Icon name="refresh" />} Проверить заново
        </button>
      </div>

      <ErrorAlert error={error} />
      {!audit && !error && (
        <div className="content-loading">
          <div className="spinner" />
          <span className="faint">Проверяем страницы сайта…</span>
        </div>
      )}

      {audit && (
        <>
          <div className="seo-summary">
            <div className="card">
              <b>{rows.length}</b>
              <span>страниц × 3 языка</span>
            </div>
            <div className="card">
              <b className={withIssues ? "is-warn" : "is-ok"}>{withIssues}</b>
              <span>с замечаниями</span>
            </div>
            <div className="card">
              <b>{Object.keys(overrides).length}</b>
              <span>изменено в админке</span>
            </div>
            <div className="card">
              <b>{timeAgo(new Date(audit.at).toISOString())}</b>
              <span>последняя проверка</span>
            </div>
          </div>

          <div className="leads__filters">
            <div className="leads__search">
              <Icon name="search" />
              <input
                className="input input--sm"
                placeholder="Адрес или название"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="select select--sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">Все страницы</option>
              {TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <Toggle checked={onlyIssues} onChange={setOnlyIssues} label="Только с замечаниями" />
          </div>

          <div className="card seo-list">
            {filtered.map((row) => (
              <button type="button" key={row.path} className="seo-row" onClick={() => open(row.path)}>
                <span className="seo-row__main">
                  <span className="seo-row__name">
                    {row.name}
                    {overrides[row.path] && <span className="chip chip--accent">изменено</span>}
                    {changed.has(row.path) && <span className="chip">обновится после публикации</span>}
                  </span>
                  <span className="seo-row__path mono faint">{row.path}</span>
                </span>
                <span className="seo-row__langs">
                  {LANGS.map(({ code, label }) => {
                    const level = levelOf(row.langs[code].issues);
                    return (
                      <span
                        key={code}
                        className={`seo-dot seo-dot--${level}`}
                        title={row.langs[code].issues.map((i) => i.text).join("\n") || "Всё хорошо"}
                      >
                        {label}
                      </span>
                    );
                  })}
                </span>
              </button>
            ))}
            {!filtered.length && <div className="leads__empty">Ничего не найдено</div>}
          </div>
          <p className="schema-field__hint seo-legend">
            <span className="seo-dot seo-dot--ok">UA</span> всё хорошо <span className="seo-dot seo-dot--warn">UA</span> есть замечания{" "}
            <span className="seo-dot seo-dot--bad">UA</span> ошибка <span className="seo-dot seo-dot--info">UA</span> скрыта от поисковиков
          </p>
        </>
      )}

      {openRow && (
        <SeoModal
          key={openRow.path}
          row={openRow}
          siteUrl={audit.siteUrl}
          override={overrides[openRow.path] || null}
          onClose={() => open(null)}
          onSaved={(path, entry) => {
            setOverrides((prev) => {
              const next = { ...prev };
              if (entry) next[path] = entry;
              else delete next[path];
              return next;
            });
            setChanged((prev) => new Set(prev).add(path));
            open(null);
          }}
        />
      )}
    </div>
  );
}

export default Seo;
