import { useEffect, useMemo, useRef, useState } from "react";

import Icon from "./Icon";
import { Modal } from "./ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useMeta } from "../lib/meta";
import {
  COLUMN_BY_KEY,
  DUE_PRESETS,
  PRIORITIES,
  PRIORITY_BY_KEY,
  TASK_COLUMNS,
  TITLE_PRESETS,
  formatDue,
  formatShort,
  isBlankHtml,
  isOverdue,
  sanitizeHtml,
  toLocalInput,
  useTasks,
} from "../lib/tasks";

import "./Tasks.css";

/* ================= картка на дошці ================= */

export function TaskCard({ task, onOpen, draggable = false, onDragStart, onDragEnd, showLead = true }) {
  const { userById, statusByCode } = useMeta();
  const column = COLUMN_BY_KEY[task.status] || TASK_COLUMNS[0];
  const priority = PRIORITY_BY_KEY[task.priority] || PRIORITY_BY_KEY.medium;
  const overdue = isOverdue(task);
  const assignee = task.assigneeId ? userById[task.assigneeId] : null;
  const subsDone = task.subtasks.filter((s) => s.done).length;

  return (
    <div
      className={`tcard ${overdue ? "is-overdue" : ""} ${task.done ? "is-closed" : ""}`}
      style={{ "--accent-col": column.color }}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(task)}
    >
      <span className="tcard__bar" />
      <div className="tcard__head">
        <div className="tcard__title">{task.title}</div>
        <span className="tcard__pri" style={{ color: priority.color, background: priority.bg }}>
          {priority.label}
        </span>
      </div>
      {overdue && <div className="tcard__overdue">⚠ Просрочено</div>}
      {showLead && task.lead && (
        <div className="tcard__project">
          <i style={{ background: statusByCode[task.lead.status]?.color || "#8a8f98" }} />#{task.lead.id} {task.lead.name}
        </div>
      )}
      <div className="tcard__foot">
        <span className="tcard__who">{assignee ? assignee.name : "—"}</span>
        <span className="tcard__meta">
          {task.subtasks.length > 0 && (
            <span className="tcard__subs">
              ☑ {subsDone}/{task.subtasks.length}
            </span>
          )}
          <span className="tcard__due" title={formatDue(task.dueAt)}>
            {formatShort(task.dueAt)}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ================= редактор опису ================= */

const exec = (command, value = null) => document.execCommand(command, false, value);

function currentBlock(editor) {
  let node = window.getSelection()?.anchorNode;
  while (node && node !== editor) {
    if (node.nodeType === 1 && /^(H3|BLOCKQUOTE|P|DIV|LI)$/.test(node.tagName)) return node;
    node = node.parentNode;
  }
  return null;
}

function RichEditor({ initial, ref: editorRef }) {
  useEffect(() => {
    editorRef.current.innerHTML = sanitizeHtml(initial);
    // Enter → новий <p>, а не <div>
    try {
      exec("defaultParagraphSeparator", "p");
    } catch {
      /* старі браузери */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBlock = (tag) => {
    editorRef.current.focus();
    const block = currentBlock(editorRef.current);
    exec("formatBlock", block?.tagName === tag ? "P" : tag);
  };

  const checklist = () => {
    editorRef.current.focus();
    exec("insertHTML", '<ul class="rte-check"><li>&#8203;</li></ul>');
  };

  const link = () => {
    const url = window.prompt("Адрес ссылки", "https://");
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) return window.alert("Ссылка должна начинаться с https://");
    editorRef.current.focus();
    if (window.getSelection()?.isCollapsed) exec("insertHTML", `<a href="${url.trim().replace(/"/g, "&quot;")}">${url.trim().replace(/</g, "&lt;")}</a>&nbsp;`);
    else exec("createLink", url.trim());
  };

  // клік по квадратику чек-листа — відмітити пункт
  const onClick = (event) => {
    const li = event.target.closest?.("ul.rte-check > li");
    if (!li) return;
    if (event.clientX - li.getBoundingClientRect().left > 24) return;
    event.preventDefault();
    if (li.getAttribute("data-done") === "1") li.removeAttribute("data-done");
    else li.setAttribute("data-done", "1");
  };

  const tools = [
    { label: "B", title: "Жирный", cls: "is-b", run: () => exec("bold") },
    { label: "I", title: "Курсив", cls: "is-i", run: () => exec("italic") },
    { label: "U", title: "Подчёркнутый", cls: "is-u", run: () => exec("underline") },
    "sep",
    { label: "H3", title: "Заголовок", cls: "is-h", run: () => toggleBlock("H3") },
    { label: "• Список", run: () => exec("insertUnorderedList") },
    { label: "1. Список", run: () => exec("insertOrderedList") },
    { label: "☑ Чек-лист", run: checklist },
    { label: "„ Цитата", run: () => toggleBlock("BLOCKQUOTE") },
    { label: "🔗 Ссылка", run: link },
  ];

  return (
    <div className="rte-box">
      <div className="rte-toolbar" onMouseDown={(e) => e.preventDefault()}>
        {tools.map((tool, index) =>
          tool === "sep" ? (
            <span key={index} className="rte-toolbar__sep" />
          ) : (
            <button key={tool.label} type="button" className={`rte-toolbar__btn ${tool.cls || ""}`} title={tool.title} onClick={tool.run}>
              {tool.label}
            </button>
          ),
        )}
      </div>
      <div
        ref={editorRef}
        className="rte"
        contentEditable
        suppressContentEditableWarning
        data-ph="Опишите задачу подробно…"
        onClick={onClick}
        onPaste={(event) => {
          // вставка — тільки чистий текст
          event.preventDefault();
          exec("insertText", event.clipboardData.getData("text/plain"));
        }}
      />
    </div>
  );
}

/* ================= вікно задачі ================= */

const newSubId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Створення / редагування задачі — як у макеті.
 * task — існуюча задача; defaults — початкові значення нової (status, leadId, assigneeId).
 */
export function TaskModal({ task = null, defaults = {}, onClose }) {
  const { user } = useAuth();
  const { users, userById } = useMeta();
  const { create, update, remove } = useTasks();
  const editorRef = useRef(null);
  const team = users.filter((u) => !u.disabled || u.id === task?.assigneeId);

  const [form, setForm] = useState(() => ({
    title: task?.title ?? defaults.title ?? "",
    subtitle: task?.subtitle ?? "",
    status: task?.status ?? defaults.status ?? "todo",
    leadId: task?.leadId ?? defaults.leadId ?? null,
    assigneeId: task?.assigneeId ?? defaults.assigneeId ?? user.id,
    priority: task?.priority ?? "medium",
    startAt: task?.startAt ?? "",
    due: toLocalInput(task ? new Date(task.dueAt) : DUE_PRESETS[2].get()),
    watchers: task?.watchers ?? [],
    subtasks: task?.subtasks ?? [],
  }));
  const [newSub, setNewSub] = useState("");
  const [leads, setLeads] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    api("/leads")
      .then(({ leads: list }) => setLeads(list))
      .catch(() => setLeads([]));
  }, []);

  const leadOptions = useMemo(() => {
    const list = (leads || []).slice().sort((a, b) => b.id - a.id).slice(0, 300);
    if (form.leadId && !list.some((l) => l.id === form.leadId)) {
      list.unshift({ id: form.leadId, data: { name: task?.lead?.name || "" } });
    }
    return list;
  }, [leads, form.leadId, task]);

  const leadName = (lead) => lead.data?.name || lead.data?.phone_full || lead.data?.email || lead.name || "Без имени";

  const addSub = () => {
    const title = newSub.trim();
    if (!title) return;
    set({ subtasks: [...form.subtasks, { id: newSubId(), title, done: false, assigneeId: null, date: null }] });
    setNewSub("");
  };
  const patchSub = (id, patch) => set({ subtasks: form.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const save = async () => {
    if (!form.title.trim()) return setError("Напишите название задачи");
    const due = new Date(form.due);
    if (!form.due || Number.isNaN(due.getTime())) return setError("Укажите дедлайн");
    const html = editorRef.current.innerHTML;
    const body = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: isBlankHtml(html) ? "" : sanitizeHtml(html),
      status: form.status,
      leadId: form.leadId,
      assigneeId: form.assigneeId,
      priority: form.priority,
      startAt: form.startAt || null,
      dueAt: due.toISOString(),
      watchers: form.watchers.filter((id) => id !== form.assigneeId),
      subtasks: form.subtasks,
    };
    setBusy(true);
    setError("");
    try {
      if (task) await update(task.id, body);
      else await create(body);
      onClose();
    } catch (saveError) {
      setError(saveError.message);
      setBusy(false);
    }
  };

  const canDelete = task && (user.role === "admin" || task.createdBy?.userId === user.id);
  const del = async () => {
    if (!window.confirm("Удалить задачу?")) return;
    try {
      await remove(task.id);
      onClose();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <Modal title={task ? "Редактирование задачи" : "Новая задача"} onClose={onClose} className="task-modal">
      <fieldset className="task-modal__body" disabled={busy}>
        <input
          className="tm-input tm-input--top tm-input--title"
          list="task-titles"
          placeholder="Название задачи"
          value={form.title}
          autoFocus={!task}
          onChange={(e) => set({ title: e.target.value })}
        />
        <datalist id="task-titles">
          {TITLE_PRESETS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <input
          className="tm-input tm-input--top"
          placeholder="Краткое описание / подзаголовок"
          value={form.subtitle}
          onChange={(e) => set({ subtitle: e.target.value })}
        />

        <div className="tm-label">Описание задачи</div>
        <RichEditor initial={task?.description || ""} ref={editorRef} />

        <label className="tm-field">
          <span className="tm-label">Статус</span>
          <select className="tm-input" value={form.status} onChange={(e) => set({ status: e.target.value })}>
            {TASK_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="tm-grid">
          <label className="tm-field">
            <span className="tm-label">Заявка</span>
            <select
              className="tm-input"
              value={form.leadId ?? ""}
              onChange={(e) => set({ leadId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">— без заявки —</option>
              {leadOptions.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  #{lead.id} {leadName(lead)}
                </option>
              ))}
            </select>
          </label>
          <label className="tm-field">
            <span className="tm-label">Ответственный</span>
            <select className="tm-input" value={form.assigneeId ?? ""} onChange={(e) => set({ assigneeId: Number(e.target.value) })}>
              {team.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === user.id ? `${u.name} (я)` : u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="tm-field">
            <span className="tm-label">Приоритет</span>
            <select className="tm-input" value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tm-field">
            <span className="tm-label">Дата старта</span>
            <input className="tm-input" type="date" value={form.startAt || ""} onChange={(e) => set({ startAt: e.target.value })} />
          </label>
          <label className="tm-field tm-field--wide">
            <span className="tm-label">Дедлайн · напоминание в Telegram</span>
            <input className="tm-input" type="datetime-local" value={form.due} onChange={(e) => set({ due: e.target.value })} />
          </label>
        </div>
        <div className="tm-presets">
          {DUE_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="tm-chip" onClick={() => set({ due: toLocalInput(preset.get()) })}>
              {preset.label}
            </button>
          ))}
        </div>

        <div className="tm-label">Доп. ответственные</div>
        <div className="tm-chips">
          {team
            .filter((u) => u.id !== form.assigneeId)
            .map((u) => {
              const on = form.watchers.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={`tm-chip ${on ? "is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => set({ watchers: on ? form.watchers.filter((id) => id !== u.id) : [...form.watchers, u.id] })}
                >
                  {u.name}
                </button>
              );
            })}
        </div>

        <div className="tm-label">Подзадачи</div>
        {form.subtasks.length > 0 && (
          <div className="tm-subs">
            {form.subtasks.map((sub) => (
              <div key={sub.id} className={`tm-sub ${sub.done ? "is-done" : ""}`}>
                <div className="tm-sub__row">
                  <button
                    type="button"
                    className="tm-sub__check"
                    aria-label={sub.done ? "Не выполнено" : "Выполнено"}
                    onClick={() => patchSub(sub.id, { done: !sub.done })}
                  >
                    {sub.done && "✓"}
                  </button>
                  <span className="tm-sub__title">{sub.title}</span>
                  <button
                    type="button"
                    className="tm-sub__del"
                    aria-label="Удалить подзадачу"
                    onClick={() => set({ subtasks: form.subtasks.filter((s) => s.id !== sub.id) })}
                  >
                    ✕
                  </button>
                </div>
                <div className="tm-sub__meta">
                  <select
                    value={sub.assigneeId ?? ""}
                    onChange={(e) => patchSub(sub.id, { assigneeId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">— ответственный —</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={sub.date || ""} onChange={(e) => patchSub(sub.id, { date: e.target.value || null })} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="tm-addsub">
          <input
            className="tm-input"
            placeholder="Новая подзадача…"
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSub();
              }
            }}
          />
          <button type="button" className="tm-btn" onClick={addSub}>
            + Добавить
          </button>
        </div>

        {task && (
          <div className="tm-info">
            Создал(а) {task.createdBy?.name || "—"} · {new Date(task.createdAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
            {task.doneBy && ` · закрыл(а) ${task.doneBy.name}`}
            {task.assigneeId && !userById[task.assigneeId]?.telegram && " · у ответственного не подключён Telegram"}
          </div>
        )}

        {error && <div className="alert">⚠ {error}</div>}

        <div className="tm-actions">
          <button type="button" className="tm-save" onClick={save}>
            {busy ? "Сохраняем…" : task ? "Сохранить" : "Создать задачу"}
          </button>
          <button type="button" className="tm-btn" onClick={onClose}>
            Отмена
          </button>
          {canDelete && (
            <button type="button" className="tm-btn tm-btn--danger" onClick={del} aria-label="Удалить задачу" title="Удалить">
              <Icon name="trash" />
            </button>
          )}
        </div>
      </fieldset>
    </Modal>
  );
}

/* ================= задачі в картці заявки ================= */

export function LeadTasks({ lead }) {
  const { tasks } = useTasks();
  const [modal, setModal] = useState(null);
  const list = tasks
    .filter((t) => t.leadId === lead.id)
    .sort((a, b) => Number(a.done) - Number(b.done) || new Date(a.dueAt) - new Date(b.dueAt));

  return (
    <div className="lead-tasks">
      {list.map((task) => (
        <TaskCard key={task.id} task={task} showLead={false} onOpen={(t) => setModal({ task: t })} />
      ))}
      {list.length === 0 && (
        <p className="lead-modal__hint">Задач нет. Например: «Перезвонить завтра в 10:00» — напоминание придёт в Telegram.</p>
      )}
      <button
        type="button"
        className="tboard__quick"
        onClick={() => setModal({ defaults: { leadId: lead.id, assigneeId: lead.managerId ?? undefined, title: "Перезвонить" } })}
      >
        <span>+</span>Задача
      </button>
      {modal && <TaskModal task={modal.task} defaults={modal.defaults} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ================= найближча задача заявки (таблиця CRM) ================= */

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
