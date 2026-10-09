import { useState } from "react";

import Icon from "./Icon";
import { ContactButtons, ManagerSelect } from "./LeadParts";
import { LeadTasks } from "./Tasks";
import { Modal } from "./ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, leadName, timeAgo } from "../lib/format";
import { useMeta } from "../lib/meta";

import "./LeadModal.css";

const FIELD_LABELS = {
  name: "Имя",
  phone_full: "Телефон",
  phone: "Телефон (без кода)",
  email: "Email",
  telegram: "Telegram",
  messenger: "Telegram / WhatsApp",
  niche: "Ниша",
  business: "Направление бизнеса",
  platforms: "Реклама",
  budget: "Бюджет",
  site: "Сайт",
  message: "Сообщение",
  prize: "Приз (колесо)",
};

const ATTRIBUTION_LABELS = {
  utm_source: "Источник (utm_source)",
  utm_medium: "Канал (utm_medium)",
  utm_campaign: "Кампания (utm_campaign)",
  utm_content: "Ключ / объявление (utm_content)",
  utm_term: "utm_term",
  utm_id: "utm_id",
  campaign_id: "Campaign ID",
  adset_id: "Adset ID",
  ad_id: "Ad ID",
  placement: "Место размещения",
  gclid: "gclid",
  fbclid: "fbclid",
  ttclid: "ttclid",
  landingPage: "Страница входа",
  referrer: "Реферер",
};

const PLATFORMS = { meta: "Meta", ga4: "GA4" };

/** Сума угоди: зберігається при виході з поля або Enter */
function AmountField({ lead, onSave }) {
  const [value, setValue] = useState(lead.amount ?? "");
  const save = () => {
    const next = value === "" ? null : Number(String(value).replace(",", "."));
    if (next !== null && !(next >= 0)) return;
    if (next !== (lead.amount ?? null)) onSave(next);
  };
  return (
    <div className="lead-amount">
      <input
        className="input"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(event) => setValue(event.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={save}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      />
      <span className="lead-amount__currency">{lead.currency}</span>
    </div>
  );
}

const label = (map, key) => (Object.hasOwn(map, key) ? map[key] : key);

/** Посилання на сторінку сайту — лише в межах pika-leads.com */
function siteUrl(page) {
  try {
    const url = new URL(page, "https://pika-leads.com");
    return url.origin === "https://pika-leads.com" ? url.href : null;
  } catch {
    return null;
  }
}

const HISTORY_TEXT = {
  created: () => "Заявка создана",
  status: (h, s) => `Статус: ${s[h.from]?.label || h.from} → ${s[h.to]?.label || h.to}`,
  manager: (h, s, u) => `Менеджер: ${u[h.to]?.name || "не назначен"}`,
  deleted: () => "Заявка удалена",
  task: (h) => (h.done ? `Задача выполнена: ${h.title}` : `Задача: ${h.title}`),
  amount: (h) => (h.to === null ? "Сумма сделки убрана" : `Сумма сделки: ${h.to} ${h.currency || ""}`),
};

function LeadModal({ lead, onChange, onDeleted, onClose }) {
  const { user } = useAuth();
  const { statuses, statusByCode, types, userById } = useMeta();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const patch = async (body) => {
    setError("");
    onChange({ ...lead, ...body });
    try {
      const { lead: updated } = await api(`/leads/${lead.id}`, { method: "PATCH", body });
      onChange(updated);
    } catch (patchError) {
      onChange(lead);
      setError(patchError.message);
    }
  };

  const sendComment = async () => {
    const text = comment.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const { lead: updated } = await api(`/leads/${lead.id}/comments`, { method: "POST", body: { text } });
      onChange(updated);
      setComment("");
    } catch (commentError) {
      setError(commentError.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Удалить заявку #${lead.id}? Она исчезнет из CRM (журнал на сервере сохранится).`)) return;
    try {
      await api(`/leads/${lead.id}`, { method: "DELETE" });
      onDeleted(lead.id);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const data = Object.entries(lead.data || {}).filter(([, value]) => value && (!Array.isArray(value) || value.length));
  const attribution = Object.entries(lead.attribution || {}).filter(([key, value]) => value && key !== "capturedAt");

  return (
    <Modal onClose={onClose} wide>
      <div className="lead-modal">
        <div className="lead-modal__main">
          <header className="lead-modal__head">
            <div className="lead-modal__id mono">
              #{lead.id} · {formatDate(lead.createdAt)} · {types[lead.type] || lead.type}
            </div>
            <h2 className="modal__title">{leadName(lead)}</h2>
            <ContactButtons lead={lead} />
          </header>

          {error && <div className="alert">⚠ {error}</div>}

          <section className="lead-modal__section">
            <h3>Статус</h3>
            <div className="status-chips">
              {statuses.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  className={`status-chip ${lead.status === s.code ? "is-active" : ""}`}
                  style={{ "--status": s.color }}
                  onClick={() => lead.status !== s.code && patch({ status: s.code })}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
            {lead.telegram && <p className="lead-modal__hint">Статус обновится и в сообщении в Telegram.</p>}
          </section>

          <section className="lead-modal__section lead-modal__manager">
            <h3>Менеджер</h3>
            <ManagerSelect value={lead.managerId} onChange={(managerId) => patch({ managerId })} className="select" />
          </section>

          <section className="lead-modal__section lead-modal__manager">
            <h3>Сумма сделки</h3>
            <AmountField key={lead.id} lead={lead} onSave={(amount) => patch({ amount })} />
            {lead.awaitingAmount && (
              <p className="lead-modal__hint lead-modal__hint--warn">Укажите сумму — событие «Покупка» уйдёт в рекламу после этого.</p>
            )}
          </section>

          <section className="lead-modal__section">
            <h3>Задачи</h3>
            <LeadTasks lead={lead} />
          </section>

          <section className="lead-modal__section">
            <h3>Данные заявки</h3>
            <dl className="lead-modal__dl">
              {data.map(([key, value]) => (
                <div key={key}>
                  <dt>{label(FIELD_LABELS, key)}</dt>
                  <dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
                </div>
              ))}
              <div>
                <dt>Форма</dt>
                <dd>
                  {types[lead.type] || lead.type}
                  {lead.source ? ` · кнопка «${lead.source}»` : ""}
                </dd>
              </div>
              {lead.page && (
                <div>
                  <dt>Страница</dt>
                  <dd>
                    {siteUrl(lead.page) ? (
                      <a href={siteUrl(lead.page)} target="_blank" rel="noreferrer noopener">
                        {lead.page}
                      </a>
                    ) : (
                      lead.page
                    )}
                    {lead.lang ? ` · ${lead.lang.toUpperCase()}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {attribution.length > 0 && (
            <section className="lead-modal__section">
              <h3>Реклама и UTM</h3>
              <dl className="lead-modal__dl lead-modal__dl--mono">
                {attribution.map(([key, value]) => (
                  <div key={key}>
                    <dt>{label(ATTRIBUTION_LABELS, key)}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {(lead.events?.length > 0 || lead.tracking) && (
            <section className="lead-modal__section">
              <h3>Реклама и аналитика</h3>
              {lead.tracking && (
                <p className="lead-modal__hint">
                  Cookie: аналитика {lead.tracking.consent?.analytics ? "✓" : "—"} · маркетинг{" "}
                  {lead.tracking.consent?.marketing ? "✓" : "—"}
                  {lead.tracking.meta ? " · клик Meta сохранён" : ""}
                  {lead.tracking.ga ? " · Google Analytics связан" : ""}
                </p>
              )}
              <ul className="lead-events">
                {(lead.events || []).map((e, index) => (
                  <li key={index} className={e.ok ? "is-ok" : e.skipped ? "is-skip" : "is-error"}>
                    <span>
                      {e.ok ? "✓" : e.skipped ? "–" : "⚠"} {PLATFORMS[e.platform] || e.platform}: <b>{e.event}</b>
                      {e.error && <small> — {e.error}</small>}
                      {e.skipped && <small> — {e.skipped}</small>}
                    </span>
                    <span className="lead-history__meta">{formatDate(e.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="lead-modal__section">
            <h3>История</h3>
            <ol className="lead-history">
              {[...(lead.history || [])].reverse().map((h, index) => (
                <li key={index}>
                  <span className="lead-history__text">
                    {Object.hasOwn(HISTORY_TEXT, h.action) ? HISTORY_TEXT[h.action](h, statusByCode, userById) : String(h.action)}
                  </span>
                  <span className="lead-history__meta">
                    {h.by?.name}
                    {h.by?.via === "telegram" ? " · Telegram" : ""} · {formatDate(h.at)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {user.role === "admin" && (
            <button type="button" className="btn btn--danger btn--sm" onClick={remove}>
              <Icon name="trash" /> Удалить заявку
            </button>
          )}
        </div>

        <aside className="lead-modal__side">
          <h3>Комментарии команды</h3>
          <div className="comments">
            {(lead.comments || []).length === 0 && <p className="comments__empty">Пока пусто. Заметки видят только сотрудники.</p>}
            {(lead.comments || []).map((c) => (
              <div key={c.id} className={`comment ${c.userId === user.id ? "comment--own" : ""}`}>
                <div className="comment__meta">
                  <b>{c.name}</b> · {timeAgo(c.at)}
                </div>
                <div className="comment__text">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="comments__form">
            <textarea
              className="textarea"
              placeholder="Заметка: о чём договорились, когда перезвонить…"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendComment();
              }}
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={sendComment} disabled={busy || !comment.trim()}>
              <Icon name="send" /> Отправить
            </button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

export default LeadModal;
