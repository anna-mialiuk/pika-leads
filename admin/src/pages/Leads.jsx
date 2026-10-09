import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Icon from "../components/Icon";
import LeadModal from "../components/LeadModal";
import NewLeadModal from "../components/NewLeadModal";
import { ContactButtons, ManagerSelect, StatusSelect } from "../components/LeadParts";
import { NextTaskBadge } from "../components/Tasks";
import { api } from "../lib/api";
import { formatDate, leadName, matchesSearch, sourceOf, timeAgo } from "../lib/format";
import { useMeta } from "../lib/meta";

import "./Leads.css";

const POLL_MS = 15_000;
const VIEW_KEY = "pika-admin-leads-view";

const PERIODS = [
  ["all", "Весь период"],
  ["today", "Сегодня"],
  ["7d", "7 дней"],
  ["30d", "30 дней"],
];

function inPeriod(lead, period) {
  if (period === "all") return true;
  const created = new Date(lead.createdAt).getTime();
  if (period === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return created >= start.getTime();
  }
  const days = period === "7d" ? 7 : 30;
  return created >= Date.now() - days * 86400_000;
}

const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) || "table";
  } catch {
    return "table";
  }
};

function Leads() {
  const meta = useMeta();
  const { statuses, statusByCode, types, userById } = meta;
  const navigate = useNavigate();
  const { id: openId } = useParams();

  const [leads, setLeads] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState(readView);
  const [filters, setFilters] = useState({ period: "all", status: "all", type: "all", manager: "all", search: "" });
  const [selected, setSelected] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [fresh, setFresh] = useState(new Set());
  const known = useRef(null);
  const dragId = useRef(null);

  // ---------- завантаження й опитування ----------
  const load = useCallback(async () => {
    try {
      const { leads: list } = await api("/leads");
      setError("");
      setLeads(list);

      const maxId = list.reduce((max, l) => Math.max(max, l.id), 0);
      if (known.current !== null && maxId > known.current) {
        const added = list.filter((l) => l.id > known.current);
        setFresh((prev) => new Set([...prev, ...added.map((l) => l.id)]));
        setToasts((prev) => [...prev, ...added.map((l) => ({ id: l.id, name: leadName(l), type: types[l.type] }))].slice(-4));
      }
      known.current = Math.max(known.current ?? 0, maxId);
    } catch (loadError) {
      if (loadError.status !== 401) setError(loadError.message);
    }
  }, [types]);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timer = setTimeout(() => setToasts((prev) => prev.slice(1)), 8000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // лічильник нових у вкладці браузера
  const newCount = leads?.filter((l) => l.status === "new").length || 0;
  useEffect(() => {
    document.title = newCount ? `(${newCount}) Заявки · Pikaleads` : "Заявки · Pikaleads";
  }, [newCount]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // ---------- зміни ----------
  const replaceLead = useCallback((lead) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
  }, []);

  const patchLead = async (id, body) => {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...body } : l)));
    setFresh((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      const { lead } = await api(`/leads/${id}`, { method: "PATCH", body });
      replaceLead(lead);
    } catch (patchError) {
      setLeads(previous);
      setError(patchError.message);
    }
  };

  const bulk = async (body) => {
    try {
      const { leads: list } = await api("/leads/bulk", { method: "POST", body: { ids: [...selected], ...body } });
      setLeads(list);
      setSelected(new Set());
    } catch (bulkError) {
      setError(bulkError.message);
    }
  };

  // ---------- фільтри ----------
  const setFilter = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }));

  const visible = useMemo(() => {
    if (!leads) return [];
    return leads.filter((lead) => {
      if (!inPeriod(lead, filters.period)) return false;
      if (filters.type !== "all" && lead.type !== filters.type) return false;
      if (filters.manager === "none" && lead.managerId) return false;
      if (filters.manager !== "all" && filters.manager !== "none" && lead.managerId !== Number(filters.manager)) return false;
      return matchesSearch(lead, filters.search);
    });
  }, [leads, filters]);

  const tableRows = useMemo(() => {
    if (filters.status === "all") return visible;
    if (filters.status === "active") return visible.filter((l) => !statusByCode[l.status]?.final);
    return visible.filter((l) => l.status === filters.status);
  }, [visible, filters.status, statusByCode]);

  const counts = useMemo(() => {
    const result = {};
    visible.forEach((l) => {
      result[l.status] = (result[l.status] || 0) + 1;
    });
    return result;
  }, [visible]);

  const usedTypes = useMemo(() => [...new Set((leads || []).map((l) => l.type))], [leads]);

  const allChecked = tableRows.length > 0 && tableRows.every((l) => selected.has(l.id));
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(tableRows.map((l) => l.id)));

  const open = (id) => navigate(`/leads/${id}`);
  const openLead = leads?.find((l) => l.id === Number(openId));

  // ---------- рендер ----------
  if (!leads) {
    return <div className="leads-loading">{error ? <div className="alert">⚠ {error}</div> : <div className="spinner" />}</div>;
  }

  return (
    <div className="leads">
      <div className="page-head">
        <div>
          <h1 className="page-title">Заявки (CRM)</h1>
          <p className="page-text">
            Все заявки с сайта. Статусы синхронизируются с кнопками в Telegram.
            {newCount > 0 && <b className="leads__new-count"> Новых: {newCount}</b>}
          </p>
        </div>
        <div className="leads__head-actions">
          <div className="segmented" role="tablist" aria-label="Вид">
            <button type="button" className={view === "table" ? "is-active" : ""} onClick={() => setView("table")}>
              <Icon name="table" /> Таблица
            </button>
            <button type="button" className={view === "kanban" ? "is-active" : ""} onClick={() => setView("kanban")}>
              <Icon name="kanban" /> Воронка
            </button>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Лид
          </button>
        </div>
      </div>

      <div className="leads__filters">
        <select className="select select--sm" value={filters.period} onChange={setFilter("period")} aria-label="Период">
          {PERIODS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {view === "table" && (
          <select className="select select--sm" value={filters.status} onChange={setFilter("status")} aria-label="Статус">
            <option value="all">Все статусы</option>
            <option value="active">В работе (не закрытые)</option>
            {statuses.map((s) => (
              <option key={s.code} value={s.code}>
                {s.emoji} {s.label} ({counts[s.code] || 0})
              </option>
            ))}
          </select>
        )}
        <select className="select select--sm" value={filters.type} onChange={setFilter("type")} aria-label="Форма">
          <option value="all">Все формы</option>
          {usedTypes.map((type) => (
            <option key={type} value={type}>
              {types[type] || type}
            </option>
          ))}
        </select>
        <select className="select select--sm" value={filters.manager} onChange={setFilter("manager")} aria-label="Менеджер">
          <option value="all">Все менеджеры</option>
          <option value="none">Не назначен</option>
          {meta.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <div className="leads__search">
          <Icon name="search" />
          <input
            className="input input--sm"
            placeholder="Имя, телефон, email, #номер…"
            value={filters.search}
            onChange={setFilter("search")}
          />
        </div>
      </div>

      {error && (
        <div className="alert">
          ⚠ {error}
          <button type="button" className="auth__link" style={{ marginLeft: "auto" }} onClick={() => setError("")}>
            скрыть
          </button>
        </div>
      )}

      {view === "table" && selected.size > 0 && (
        <div className="bulk-bar">
          <strong>Выбрано: {selected.size}</strong>
          <select
            className="select select--sm"
            value=""
            onChange={(e) => e.target.value && bulk({ status: e.target.value })}
            aria-label="Статус для выбранных"
          >
            <option value="">Сменить статус…</option>
            {statuses.map((s) => (
              <option key={s.code} value={s.code}>
                {s.emoji} {s.label}
              </option>
            ))}
          </select>
          <select
            className="select select--sm"
            value=""
            onChange={(e) => e.target.value && bulk({ managerId: e.target.value === "none" ? null : Number(e.target.value) })}
            aria-label="Менеджер для выбранных"
          >
            <option value="">Назначить менеджера…</option>
            <option value="none">— снять менеджера —</option>
            {meta.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(new Set())}>
            Снять выделение
          </button>
        </div>
      )}

      {view === "table" ? (
        <>
          <div className="card leads-table-wrap">
            <table className="leads-table">
              <thead>
                <tr>
                  <th className="leads-table__check">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Выбрать все" />
                  </th>
                  <th>Заявка</th>
                  <th>Контакт / связь</th>
                  <th>Ниша / форма</th>
                  <th>Источник</th>
                  <th>Менеджер</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((lead) => {
                  const source = sourceOf(lead);
                  return (
                    <tr key={lead.id} className={fresh.has(lead.id) ? "is-fresh" : ""} onClick={() => open(lead.id)}>
                      <td className="leads-table__check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggle(lead.id)}
                          aria-label={`Выбрать #${lead.id}`}
                        />
                      </td>
                      <td>
                        <div className="leads-table__name">{leadName(lead)}</div>
                        <NextTaskBadge leadId={lead.id} />
                        <div className="leads-table__meta mono">
                          #{lead.id} · {formatDate(lead.createdAt)}
                        </div>
                      </td>
                      <td>
                        <ContactButtons lead={lead} />
                      </td>
                      <td>
                        <div>{lead.data?.niche || lead.data?.business || "—"}</div>
                        <div className="leads-table__meta">{types[lead.type] || lead.type}</div>
                      </td>
                      <td>
                        <div>{source.main}</div>
                        <div className="leads-table__meta leads-table__ellipsis">{source.sub}</div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <ManagerSelect value={lead.managerId} onChange={(managerId) => patchLead(lead.id, { managerId })} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <StatusSelect value={lead.status} onChange={(status) => patchLead(lead.id, { status })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!tableRows.length && <div className="leads__empty">Заявок по этим фильтрам нет</div>}
          </div>

          {/* телефон: картки замість таблиці */}
          <div className="lead-cards">
            {tableRows.map((lead) => (
              <article key={lead.id} className={`card lead-card ${fresh.has(lead.id) ? "is-fresh" : ""}`} onClick={() => open(lead.id)}>
                <div className="lead-card__top">
                  <div>
                    <div className="leads-table__name">{leadName(lead)}</div>
                    <NextTaskBadge leadId={lead.id} />
                    <div className="leads-table__meta mono">
                      #{lead.id} · {timeAgo(lead.createdAt)}
                    </div>
                  </div>
                  <StatusSelect value={lead.status} onChange={(status) => patchLead(lead.id, { status })} size="sm" />
                </div>
                <div className="leads-table__meta">
                  {types[lead.type] || lead.type} · {sourceOf(lead).main}
                  {lead.managerId ? ` · ${userById[lead.managerId]?.name || ""}` : ""}
                </div>
                <ContactButtons lead={lead} />
              </article>
            ))}
            {!tableRows.length && <div className="leads__empty">Заявок по этим фильтрам нет</div>}
          </div>
        </>
      ) : (
        <div className="kanban">
          {statuses.map((status) => {
            const items = visible.filter((l) => l.status === status.code);
            return (
              <section
                key={status.code}
                className="kanban__column"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.currentTarget.classList.add("is-over");
                }}
                onDragLeave={(event) => event.currentTarget.classList.remove("is-over")}
                onDrop={(event) => {
                  event.currentTarget.classList.remove("is-over");
                  event.preventDefault();
                  const id = dragId.current ?? Number(event.dataTransfer.getData("text/plain"));
                  dragId.current = null;
                  const lead = leads.find((l) => l.id === id);
                  if (lead && lead.status !== status.code) patchLead(id, { status: status.code });
                }}
              >
                <header className="kanban__head" style={{ "--status": status.color }}>
                  <span>
                    {status.emoji} {status.label}
                  </span>
                  <b>{items.length}</b>
                </header>
                <div className="kanban__list">
                  {items.map((lead) => (
                    <article
                      key={lead.id}
                      className={`kanban__card ${fresh.has(lead.id) ? "is-fresh" : ""}`}
                      draggable
                      onDragStart={(event) => {
                        dragId.current = lead.id;
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(lead.id));
                      }}
                      onClick={() => open(lead.id)}
                    >
                      <div className="leads-table__name">{leadName(lead)}</div>
                      <NextTaskBadge leadId={lead.id} />
                      <div className="leads-table__meta">
                        #{lead.id} · {timeAgo(lead.createdAt)}
                      </div>
                      <div className="leads-table__meta">
                        {lead.data?.niche || types[lead.type]} · {sourceOf(lead).main}
                      </div>
                      <div className="kanban__foot">
                        <ContactButtons lead={lead} compact />
                        {lead.managerId && (
                          <span className="kanban__manager" title={userById[lead.managerId]?.name}>
                            {(userById[lead.managerId]?.name || "?").slice(0, 1)}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                  {!items.length && <div className="kanban__empty">Перетащите сюда</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {openLead && (
        <LeadModal
          lead={openLead}
          onChange={replaceLead}
          onDeleted={(id) => {
            setLeads((prev) => prev.filter((l) => l.id !== id));
            navigate("/leads");
          }}
          onClose={() => navigate("/leads")}
        />
      )}
      {openId && leads && !openLead && <NotFound onClose={() => navigate("/leads")} />}

      {creating && (
        <NewLeadModal
          onClose={() => setCreating(false)}
          onCreated={(lead) => {
            setLeads((prev) => [lead, ...prev]);
            known.current = Math.max(known.current ?? 0, lead.id);
            setCreating(false);
          }}
        />
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast"
            onClick={() => {
              setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              open(toast.id);
            }}
          >
            <strong>🔥 Новая заявка #{toast.id}</strong>
            {toast.name} · {toast.type}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotFound({ onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 1500);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="toasts">
      <div className="toast">Заявка не найдена</div>
    </div>
  );
}

export default Leads;
