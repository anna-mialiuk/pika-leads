/** Траст соц-профілів Meta + черга контенту на прогрів (AI-чернетки, публікація вручну) */
import { useState } from "react";

import { CopyButton, ErrorAlert, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { LANG, t, tt } from "../../lib/i18n";
import { ink } from "../../lib/theme";
import { Ring, Switch } from "./parts";
import { fmtNum } from "./data";

const SIGNALS = [
  ["profile", t("Заполненность профиля"), t("описание, категория, сайт, часы работы")],
  ["activity", t("Активность и постинг"), t("регулярные посты за последние 30 дней")],
  ["reviews", t("Отзывы и оценки"), t("рейтинг и количество отзывов")],
  ["media", t("Качество медиа"), t("аватар, обложка, фирменный визуал")],
  ["contacts", t("Контакты и верификация"), t("телефон, email, подтверждённый домен")],
  ["history", t("История аккаунта"), t("возраст страницы, отсутствие ограничений")],
];
const TYPE_LABELS = { post: t("Пост"), profile: t("Профиль"), media: t("Медиа") };
const TYPE_COLORS = { post: "#6fa8ff", profile: "#c69bff", media: "#FFC629" };
const STATUS = { pending: t("Ждёт одобрения"), approved: t("Одобрено"), published: t("Опубликовано") };

const scoreColor = (s) => (s >= 70 ? "#5ac878" : s >= 45 ? "#FFC629" : "#ff7d7d");
const scoreLabel = (s) => (s >= 70 ? t("Высокий траст") : s >= 45 ? t("Средний траст") : t("Низкий траст"));

export default function Trust({ pages, cabinets, ai, onReload }) {
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const low = pages.filter((p) => p.score < 45).length;
  const queue = pages.flatMap((p) => p.queue.filter((q) => q.status !== "published").map((q) => ({ ...q, page: p })));
  const approved = queue.filter((q) => q.status === "approved").length;

  const call = async (fn, id = null) => {
    setError("");
    setBusy(id);
    try {
      await fn();
      onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="an-card an-trust">
      <div className="an-trust__head">
        <div className="an-trust__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b9bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div className="an-card__title">{t("Траст соц-профилей Meta")}</div>
          <p className="an-muted">{t("Оцениваем доверие Meta к бизнес-странице перед запуском рекламы. При низком показателе AI готовит посты и подсказки для профиля — публикуете вы, после одобрения.")}</p>
        </div>
        {low > 0 && <span className="an-tag an-tag--solid" style={{ "--tag": "#ff7d7d" }}>{tt("{0} требуют прогрева", low)}</span>}
        <button type="button" className="btn btn--sm" onClick={() => setEdit({})}>
          {t("+ Страница")}
        </button>
      </div>
      <ErrorAlert error={error} />

      {pages.length === 0 ? (
        <p className="an-muted">{t("Добавьте бизнес-страницы Facebook/Instagram, через которые идёт реклама, — оценим траст и подскажем, что прогреть.")}</p>
      ) : (
        <div className="an-trust__grid">
          {pages.map((p) => {
            const pending = p.queue.filter((q) => q.status === "pending").length;
            const appr = p.queue.filter((q) => q.status === "approved").length;
            const pub = p.queue.filter((q) => q.status === "published").length;
            return (
              <div key={p.id} className="an-page" style={{ "--score": scoreColor(p.score) }}>
                <div className="an-page__top">
                  <Ring value={p.score} color={scoreColor(p.score)} size={84} stroke={8} sub="/ 100" />
                  <div>
                    <b>{p.name}</b>
                    <span className="faint">
                      {p.handle || "—"} · {tt("{0} подписчиков", fmtNum(p.followers))}
                    </span>
                    <span className="an-tag an-tag--solid" style={{ "--tag": scoreColor(p.score) }}>
                      {scoreLabel(p.score)}
                    </span>
                  </div>
                  <button type="button" className="icon-btn" title={t("Изменить")} aria-label={t("Изменить")} onClick={() => setEdit(p)}>
                    ✎
                  </button>
                </div>
                <div className="an-page__signals">
                  {SIGNALS.map(([key, label]) => (
                    <div key={key}>
                      <div>
                        <span>{label}</span>
                        <b style={{ color: ink(scoreColor(p.signals[key] || 0)) }}>{p.signals[key] || 0}</b>
                      </div>
                      <div className="an-bar" style={{ height: 4 }}>
                        <div style={{ width: `${p.signals[key] || 0}%`, background: scoreColor(p.signals[key] || 0) }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="an-page__foot">
                  <label>
                    <Switch on={p.autoWarm} label={t("Авто-прогрев профиля")} color="#5ac878" onChange={(v) => call(() => api(`/analytics/pages/${p.id}`, { method: "PATCH", body: { autoWarm: v } }))} />
                    <span title={t("Раз в неделю AI готовит новые черновики, пока траст ниже 70")}>{t("Авто-прогрев профиля")}</span>
                  </label>
                  {ai && (
                    <button type="button" className="btn btn--sm an-btn-blue" disabled={busy === p.id} onClick={() => call(() => api(`/analytics/pages/${p.id}/generate`, { method: "POST", body: { lang: LANG } }), p.id)}>
                      {busy === p.id ? t("AI пишет…") : t("✦ Сгенерировать контент")}
                    </button>
                  )}
                </div>
                {pending + appr + pub > 0 && <div className="an-page__queue faint">{tt("В очереди: {0} на одобрение · {1} одобрено · {2} опубликовано", pending, appr, pub)}</div>}
              </div>
            );
          })}
        </div>
      )}

      {queue.length > 0 && (
        <>
          <div className="an-trust__qhead">
            <span>{t("Очередь публикаций")}</span>
            <i />
            {approved > 0 && (
              <button type="button" className="btn btn--sm an-btn-green" onClick={() => call(() => api("/analytics/pages/publish-approved", { method: "POST" }))}>
                {tt("Отметить опубликованными ({0})", approved)}
              </button>
            )}
          </div>
          <div className="an-stack an-stack--xs">
            {queue.map((q) => (
              <div key={q.id} className="an-queue">
                <span className="an-tag" style={{ "--tag": TYPE_COLORS[q.type] }}>
                  {TYPE_LABELS[q.type]}
                </span>
                <div className="an-queue__text">
                  <b>{q.title}</b>
                  <span>{q.preview}</span>
                  <small className="faint">{q.page.name}</small>
                </div>
                <div className="an-queue__actions">
                  <CopyButton value={`${q.title}\n\n${q.preview}`} className="icon-btn" label={t("Копировать текст")} />
                  {q.status === "pending" ? (
                    <>
                      <button type="button" className="btn btn--sm an-btn-green" onClick={() => call(() => api(`/analytics/pages/${q.page.id}/queue/${q.id}`, { method: "POST", body: { status: "approved" } }))}>
                        {t("Одобрить")}
                      </button>
                      <button type="button" className="icon-btn" title={t("Отклонить")} aria-label={t("Отклонить")} onClick={() => call(() => api(`/analytics/pages/${q.page.id}/queue/${q.id}`, { method: "POST", body: { status: "rejected" } }))}>
                        ✕
                      </button>
                    </>
                  ) : null}
                  <span className={`an-tag ${q.status === "approved" ? "" : ""}`} style={{ "--tag": q.status === "approved" ? "#5ac878" : "#FFC629" }}>
                    {STATUS[q.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {edit && <PageModal page={edit} cabinets={cabinets} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onReload(); }} />}
    </section>
  );
}

function PageModal({ page, cabinets, onClose, onSaved }) {
  const isNew = !page.id;
  const [f, setF] = useState({
    name: page.name || "",
    handle: page.handle || "",
    followers: page.followers ?? "",
    cabinetId: page.cabinetId || "",
    signals: { profile: 50, activity: 50, reviews: 50, media: 50, contacts: 50, history: 50, ...(page.signals || {}) },
  });
  const [error, setError] = useState("");
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const score = Math.round(SIGNALS.reduce((s, [k], i) => s + (Number(f.signals[k]) || 0) * [0.2, 0.2, 0.15, 0.15, 0.15, 0.15][i], 0));
  const save = async () => {
    setError("");
    try {
      const body = { ...f, followers: Number(f.followers) || 0, cabinetId: f.cabinetId || null };
      if (isNew) await api("/analytics/pages", { method: "POST", body });
      else await api(`/analytics/pages/${page.id}`, { method: "PATCH", body });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async () => {
    if (!window.confirm(tt("Удалить страницу «{0}»?", page.name))) return;
    try {
      await api(`/analytics/pages/${page.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal title={isNew ? t("Новая страница Meta") : page.name} onClose={onClose}>
      <div className="an-form">
        <div className="an-form__row an-form__row--2">
          <label className="an-field">
            <span>{t("Название страницы")}</span>
            <input className="input" value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="an-field">
            <span>{t("Никнейм")}</span>
            <input className="input" value={f.handle} maxLength={60} placeholder="@pikaleads" onChange={(e) => set({ handle: e.target.value })} />
          </label>
          <label className="an-field">
            <span>{t("Подписчиков")}</span>
            <input className="input" inputMode="numeric" value={f.followers} onChange={(e) => set({ followers: e.target.value.replace(/\D/g, "") })} />
          </label>
          <label className="an-field">
            <span>{t("Кабинет")}</span>
            <select className="select" value={f.cabinetId} onChange={(e) => set({ cabinetId: e.target.value })}>
              <option value="">{t("— не привязана —")}</option>
              {cabinets
                .filter((c) => c.platform === "meta")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="an-form__block">
          <div className="an-form__cap">
            {t("Сигналы траста")} · <b style={{ color: ink(scoreColor(score)) }}>{tt("{0} / 100", score)}</b>
          </div>
          {SIGNALS.map(([key, label, hint]) => (
            <label key={key} className="an-slider">
              <span>
                <b>{label}</b>
                <small>{hint}</small>
              </span>
              <input type="range" min="0" max="100" step="5" value={f.signals[key]} onChange={(e) => set({ signals: { ...f.signals, [key]: Number(e.target.value) } })} />
              <b>{f.signals[key]}</b>
            </label>
          ))}
        </div>
        <ErrorAlert error={error} />
        <div className="an-form__actions">
          {!isNew && (
            <button type="button" className="btn btn--danger btn--sm" onClick={remove}>
              {t("Удалить")}
            </button>
          )}
          <span className="an-form__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t("Отмена")}
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            {t("Сохранить")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
