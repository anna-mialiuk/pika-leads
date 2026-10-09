import { useState } from "react";
import { Link } from "react-router-dom";

import Icon from "./Icon";
import { useAuth } from "../lib/auth";
import { useMeta } from "../lib/meta";
import { DUE_PRESETS, TITLE_PRESETS, formatDue, isOverdue, toLocalInput, useTasks } from "../lib/tasks";

import "./Tasks.css";

/** Нова задача: що зробити, коли, хто */
export function TaskForm({ leadId = null, defaultAssignee = null, onDone, compact = false }) {
  const { user } = useAuth();
  const { users } = useMeta();
  const { create } = useTasks();
  const [title, setTitle] = useState(leadId ? "Перезвонить" : "");
  const [due, setDue] = useState(() => toLocalInput(DUE_PRESETS[2].get()));
  const [assigneeId, setAssigneeId] = useState(defaultAssignee ?? user.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim()) return setError("Напишите, что сделать");
    setBusy(true);
    setError("");
    try {
      await create({ leadId, title: title.trim(), dueAt: new Date(due).toISOString(), assigneeId });
      setTitle(leadId ? "Перезвонить" : "");
      onDone?.();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`task-form ${compact ? "task-form--compact" : ""}`}>
      <input
        className="input input--sm"
        list="task-titles"
        value={title}
        placeholder="Что сделать: перезвонить, отправить КП…"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <datalist id="task-titles">
        {TITLE_PRESETS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="task-form__presets">
        {DUE_PRESETS.map((preset) => (
          <button key={preset.label} type="button" className="chip-btn" onClick={() => setDue(toLocalInput(preset.get()))}>
            {preset.label}
          </button>
        ))}
      </div>
      <div className="task-form__row">
        <input className="input input--sm" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        <select
          className="select select--sm"
          value={assigneeId ?? ""}
          onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
        >
          {users
            .filter((u) => !u.disabled)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === user.id ? `${u.name} (я)` : u.name}
              </option>
            ))}
        </select>
        <button type="button" className="btn btn--primary btn--sm" onClick={submit} disabled={busy}>
          <Icon name="plus" /> Задача
        </button>
      </div>
      {error && <div className="field-error">⚠ {error}</div>}
    </div>
  );
}

/** Одна задача в списку */
export function TaskItem({ task, showLead = true, onOpenLead }) {
  const { user } = useAuth();
  const { userById } = useMeta();
  const { update, remove } = useTasks();
  const [error, setError] = useState("");
  const overdue = isOverdue(task);
  const assignee = task.assigneeId ? userById[task.assigneeId] : null;
  const canDelete = user.role === "admin" || task.createdBy?.userId === user.id;

  const toggle = () => update(task.id, { done: !task.done }).catch((e) => setError(e.message));
  const snooze = (minutes) =>
    update(task.id, { dueAt: new Date(Math.max(Date.now(), new Date(task.dueAt)) + minutes * 60_000).toISOString() }).catch((e) =>
      setError(e.message),
    );

  return (
    <div className={`task-item ${task.done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}`}>
      <button type="button" className="task-item__check" onClick={toggle} aria-label={task.done ? "Вернуть в работу" : "Выполнено"}>
        {task.done && <Icon name="check" size={14} strokeWidth="2.6" />}
      </button>
      <div className="task-item__main">
        <div className="task-item__title">{task.title}</div>
        <div className="task-item__meta">
          <span className="task-item__due">
            <Icon name="clock" size={13} /> {formatDue(task.dueAt)}
            {overdue && " · просрочено"}
          </span>
          {assignee && <span>· {assignee.id === user.id ? "я" : assignee.name}</span>}
          {showLead && task.lead && (
            <>
              <span>·</span>
              {onOpenLead ? (
                <button type="button" className="task-item__lead" onClick={() => onOpenLead(task.lead.id)}>
                  #{task.lead.id} {task.lead.name}
                </button>
              ) : (
                <Link className="task-item__lead" to={`/leads/${task.lead.id}`}>
                  #{task.lead.id} {task.lead.name}
                </Link>
              )}
            </>
          )}
        </div>
        {error && <div className="field-error">⚠ {error}</div>}
      </div>
      {!task.done && (
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          title="Отложить на час"
          aria-label="Отложить на час"
          onClick={() => snooze(60)}
        >
          <Icon name="clock" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="icon-btn icon-btn--sm icon-btn--danger"
          title="Удалить"
          aria-label="Удалить задачу"
          onClick={() => window.confirm("Удалить задачу?") && remove(task.id).catch((e) => setError(e.message))}
        >
          <Icon name="trash" />
        </button>
      )}
    </div>
  );
}

/** Задачі в картці заявки */
export function LeadTasks({ lead }) {
  const { tasks } = useTasks();
  const [adding, setAdding] = useState(false);
  const list = tasks
    .filter((t) => t.leadId === lead.id)
    .sort((a, b) => Number(a.done) - Number(b.done) || new Date(a.dueAt) - new Date(b.dueAt));
  return (
    <div className="lead-tasks">
      {list.map((task) => (
        <TaskItem key={task.id} task={task} showLead={false} />
      ))}
      {list.length === 0 && !adding && (
        <p className="lead-modal__hint">Задач нет. Например: «Перезвонить завтра в 10:00» — напоминание придёт в Telegram.</p>
      )}
      {adding ? (
        <TaskForm leadId={lead.id} defaultAssignee={lead.managerId} onDone={() => setAdding(false)} compact />
      ) : (
        <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
          <Icon name="plus" /> Добавить задачу
        </button>
      )}
    </div>
  );
}

/** Найближча задача заявки (для таблиці CRM) */
export function NextTaskBadge({ leadId }) {
  const { tasks } = useTasks();
  const next = tasks.filter((t) => t.leadId === leadId && !t.done).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0];
  if (!next) return null;
  return (
    <span className={`task-badge ${isOverdue(next) ? "is-overdue" : ""}`} title={next.title}>
      <Icon name="clock" size={12} /> {formatDue(next.dueAt)}
    </span>
  );
}
