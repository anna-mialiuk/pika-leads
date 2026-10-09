import { useEffect, useMemo, useRef, useState } from "react";

import Icon from "./Icon";
import { Modal } from "./ui";
import { api, fileIcon, fileUrl, formatSize } from "../lib/api";
import { initials, useProjects } from "../lib/projects";
import { useAuth } from "../lib/auth";
import { useMeta } from "../lib/meta";
import {
  DUE_PRESETS,
  PRIORITIES,
  PRIORITY_BY_KEY,
  TITLE_PRESETS,
  formatDue,
  formatHMS,
  formatShort,
  isBlankHtml,
  isOverdue,
  sanitizeHtml,
  toLocalInput,
  useColumns,
  useTasks,
} from "../lib/tasks";

import "./Tasks.css";
import { t, tt, LOCALE } from "../lib/i18n";
import { can } from "../lib/roles";

/* ================= картка на дошці ================= */

export function TaskCard({ task, onOpen, draggable = false, onDragStart, onDragEnd, showLead = true }) {
  const { userById, statusByCode } = useMeta();
  const { byId: projectById } = useProjects();
  const { columns, byKey } = useColumns();
  const column = byKey[task.status] || columns[0];
  const priority = PRIORITY_BY_KEY[task.priority] || PRIORITY_BY_KEY.medium;
  const overdue = isOverdue(task);
  const assignee = task.assigneeId ? userById[task.assigneeId] : null;
  const subsDone = task.subtasks.filter((s) => s.done).length;
  const project = task.projectId ? projectById[task.projectId] : null;

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
      {overdue && <div className="tcard__overdue">{t("⚠ Просрочено")}</div>}
      {project && (
        <div className="tcard__project">
          <i style={{ background: project.color }} />
          {project.name}
        </div>
      )}
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
    const url = window.prompt(t("Адрес ссылки"), "https://");
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) return window.alert(t("Ссылка должна начинаться с https://"));
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
    { label: "B", title: t("Жирный"), cls: "is-b", run: () => exec("bold") },
    { label: "I", title: t("Курсив"), cls: "is-i", run: () => exec("italic") },
    { label: "U", title: t("Подчёркнутый"), cls: "is-u", run: () => exec("underline") },
    "sep",
    { label: "H3", title: t("Заголовок"), cls: "is-h", run: () => toggleBlock("H3") },
    { label: t("• Список"), run: () => exec("insertUnorderedList") },
    { label: t("1. Список"), run: () => exec("insertOrderedList") },
    { label: t("☑ Чек-лист"), run: checklist },
    { label: t("„ Цитата"), run: () => toggleBlock("BLOCKQUOTE") },
    { label: t("🔗 Ссылка"), run: link },
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
        data-ph={t("Опишите задачу подробно…")}
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
const timeOf = (iso) => new Date(iso).toLocaleString(LOCALE, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dayDispShort = (iso) => (iso ? iso.split("-").reverse().join(".") : "—");

/** Таймер задачі: у збереженої — на сервері (видно всім), у нової — локально до збереження */
const draftTotal = (draft) => draft.seconds + (draft.start ? Math.floor((Date.now() - draft.start) / 1000) : 0);

function TaskTimer({ task, draft, setDraft }) {
  const { user } = useAuth();
  const { timer } = useTasks();
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const running = task ? Boolean(task.timerStartedAt) : Boolean(draft.start);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const seconds = task
    ? task.timeSpent + (task.timerStartedAt ? Math.max(0, (now - Date.parse(task.timerStartedAt)) / 1000) : 0)
    : draft.seconds + (draft.start ? Math.max(0, (now - draft.start) / 1000) : 0);

  const run = (action) => {
    setError("");
    if (task) return timer(task.id, action).catch((e) => setError(e.message));
    if (action === "start") {
      setNow(Date.now());
      setDraft((d) => ({ ...d, start: Date.now() }));
    }
    if (action === "stop") setDraft((d) => ({ seconds: draftTotal(d), start: null }));
    if (action === "reset") setDraft({ seconds: 0, start: null });
    return null;
  };

  return (
    <>
      <div className="tm-timer">
        <div className="tm-timer__time">{formatHMS(seconds)}</div>
        {task?.timerBy && task.timerBy.userId !== user.id && <div className="tm-timer__who">{t("идёт ·")}{" "}{task.timerBy.name}</div>}
        <div className="tm-timer__btns">
          {running ? (
            <button type="button" className="tm-timer__btn is-stop" onClick={() => run("stop")}>{t("⏸ Пауза")}</button>
          ) : (
            <button type="button" className="tm-timer__btn is-start" onClick={() => run("start")}>{t("▶ Старт")}</button>
          )}
          <button
            type="button"
            className="tm-timer__btn is-reset"
            onClick={() => (seconds < 60 || window.confirm(t("Сбросить учтённое время?"))) && run("reset")}
          >{t("Сброс")}</button>
        </div>
      </div>
      {error && <div className="field-error">⚠ {error}</div>}
    </>
  );
}

/** Коментарі: @згадка надсилає повідомлення в Telegram */
function TaskComments({ task, drafts, setDrafts }) {
  const { user } = useAuth();
  const { users, userById } = useMeta();
  const { comment, deleteComment } = useTasks();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState([]);
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const team = users.filter((u) => !u.disabled);
  const list = task ? task.comments : drafts;

  const mention = (u) => {
    const next = `${text.replace(/\s*$/, "")}${text.trim() ? " " : ""}@${u.name} `;
    setText(next);
    setMentions((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
    // курсор — у кінець, щоб одразу писати далі
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(next.length, next.length));
  };

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    // згадка лишається, лише якщо «@Ім'я» досі в тексті
    const ids = [...new Set([...mentions, ...team.filter((u) => value.includes(`@${u.name}`)).map((u) => u.id)])].filter((id) =>
      value.includes(`@${userById[id]?.name}`),
    );
    setError("");
    if (!task) {
      setDrafts((prev) => [...prev, { id: newSubId(), userId: user.id, name: user.name, text: value, mentions: ids, at: new Date().toISOString(), draft: true }]);
      setText("");
      setMentions([]);
      return;
    }
    setBusy(true);
    try {
      await comment(task.id, value, ids);
      setText("");
      setMentions([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (c) => {
    if (!task) return setDrafts((prev) => prev.filter((x) => x.id !== c.id));
    if (!window.confirm(t("Удалить комментарий?"))) return null;
    return deleteComment(task.id, c.id).catch((e) => setError(e.message));
  };

  return (
    <>
      {list.length > 0 && (
        <div className="tm-comments">
          {list.map((c) => (
            <div key={c.id} className="tm-comment">
              <div className="tm-comment__av">{initials(c.name)}</div>
              <div className="tm-comment__body">
                <div className="tm-comment__head">
                  <span className="tm-comment__author">{c.name}</span>
                  <span className="tm-comment__time">{c.draft ? t("отправится при сохранении") : timeOf(c.at)}</span>
                  {(c.userId === user.id || can(user, "manage")) && (
                    <button type="button" className="tm-comment__del" aria-label={t("Удалить комментарий")} onClick={() => remove(c)}>
                      ✕
                    </button>
                  )}
                </div>
                <div className="tm-comment__text">{c.text}</div>
                {c.mentions?.length > 0 && (
                  <div className="tm-comment__mentions">
                    {c.mentions.map((id) => (
                      <span key={id}>🔔 {userById[id]?.name || t("сотрудник")}{" "}{t("уведомлён")}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="tm-mention">
        <span>{t("Отметить:")}</span>
        {team
          .filter((u) => u.id !== user.id)
          .map((u) => (
            <button key={u.id} type="button" className="tm-mention__chip" onClick={() => mention(u)}>
              @{u.name}
            </button>
          ))}
      </div>
      <div className="tm-addsub tm-addsub--comment">
        <input
          ref={inputRef}
          className="tm-input"
          placeholder={t("Комментарий… (@имя чтобы отметить)")}
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="button" className="tm-send" onClick={send} disabled={busy}>{t("Отправить")}</button>
      </div>
      {error && <div className="field-error">⚠ {error}</div>}
    </>
  );
}

/** Вкладення: у збереженої — одразу на сервер, у нової — після збереження */
function TaskFiles({ task, drafts, setDrafts, call, onToggleCall }) {
  const { addFile, removeFile } = useTasks();
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");

  const pick = async (event) => {
    const picked = [...(event.target.files || [])];
    event.target.value = "";
    if (!picked.length) return;
    setError("");
    const tooBig = picked.find((f) => f.size > 25 * 1024 * 1024);
    if (tooBig) return setError(tt("«{0}» больше 25 МБ", tooBig.name));
    if (!task) return setDrafts((prev) => [...prev, ...picked]);
    for (const file of picked) {
      setBusy((n) => n + 1);
      try {
        await addFile(task.id, file);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    return null;
  };

  const files = task ? task.files : drafts.map((f, index) => ({ id: `d${index}`, name: f.name, size: f.size, draft: index }));

  return (
    <>
      <div className="tm-actions-row">
        <label className="tm-attach">
          <span>📎</span>
          {busy ? t("Загружаем…") : t("Прикрепить файл")}
          <input type="file" multiple onChange={pick} hidden />
        </label>
        <button type="button" className={`tm-callbtn ${call ? "is-on" : ""}`} onClick={onToggleCall} aria-pressed={call}>
          <Icon name="phone" size={15} />
          {call ? t("✓ Звонок запланирован") : t("Запланировать звонок")}
        </button>
      </div>
      {files.length > 0 && (
        <div className="tm-files">
          {files.map((f) => (
            <div key={f.id} className="tm-file">
              <span className="tm-file__icon">{fileIcon(f.name)}</span>
              {f.draft === undefined ? (
                <a className="tm-file__name" href={fileUrl(f.id)} download={f.name}>
                  {f.name}
                </a>
              ) : (
                <span className="tm-file__name">{f.name}</span>
              )}
              <span className="tm-file__size">{formatSize(f.size)}</span>
              <button
                type="button"
                className="tm-file__del"
                aria-label={t("Удалить файл")}
                onClick={() =>
                  f.draft !== undefined
                    ? setDrafts((prev) => prev.filter((_, i) => i !== f.draft))
                    : window.confirm(tt("Удалить «{0}»?", f.name)) && removeFile(f.id).catch((e) => setError(e.message))
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <div className="field-error">⚠ {error}</div>}
    </>
  );
}

/**
 * Створення / редагування задачі — повністю як у макеті.
 * task — існуюча задача; defaults — початкові значення нової (status, leadId, projectId, assigneeId, title).
 */
export function TaskModal({ task: initialTask = null, defaults = {}, onClose }) {
  const { user } = useAuth();
  const { users, userById } = useMeta();
  const { tasks, create, update, remove, comment, addFile } = useTasks();
  const { projects, byId: projectById } = useProjects();
  const { columns } = useColumns();
  const editorRef = useRef(null);
  // свіжа версія задачі (коментарі, файли, таймер оновлюються одразу)
  const task = initialTask ? tasks.find((t) => t.id === initialTask.id) || initialTask : null;
  const team = users.filter((u) => !u.disabled || u.id === task?.assigneeId);

  const [form, setForm] = useState(() => {
    const projectId = initialTask?.projectId ?? defaults.projectId ?? null;
    return {
      title: initialTask?.title ?? defaults.title ?? "",
      subtitle: initialTask?.subtitle ?? "",
      status: initialTask?.status ?? defaults.status ?? "todo",
      projectId,
      pmId: initialTask?.pmId ?? (projectId ? projectById[projectId]?.pmId : null) ?? null,
      leadId: initialTask?.leadId ?? defaults.leadId ?? null,
      assigneeId: initialTask?.assigneeId ?? defaults.assigneeId ?? user.id,
      priority: initialTask?.priority ?? "medium",
      startAt: initialTask?.startAt ?? "",
      due: toLocalInput(initialTask ? new Date(initialTask.dueAt) : defaults.due || DUE_PRESETS[2].get()),
      watchers: initialTask?.watchers ?? [],
      subtasks: initialTask?.subtasks ?? [],
      call: initialTask?.call ?? false,
    };
  });
  const [newSub, setNewSub] = useState("");
  const [leads, setLeads] = useState(null);
  const [draftComments, setDraftComments] = useState([]);
  const [draftFiles, setDraftFiles] = useState([]);
  const [draftTimer, setDraftTimer] = useState({ seconds: 0, start: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!can(user, "leads")) return undefined;
    api("/leads")
      .then(({ leads: list }) => setLeads(list))
      .catch(() => setLeads([]));
  }, [user]);

  const leadOptions = useMemo(() => {
    const list = (leads || []).slice().sort((a, b) => b.id - a.id).slice(0, 300);
    if (form.leadId && !list.some((l) => l.id === form.leadId)) {
      list.unshift({ id: form.leadId, data: { name: task?.lead?.name || "" } });
    }
    return list;
  }, [leads, form.leadId, task]);

  const leadName = (lead) => lead.data?.name || lead.data?.phone_full || lead.data?.email || lead.name || t("Без имени");
  const projectOptions = projects.filter((p) => p.status !== "done" || p.id === form.projectId);

  const addSub = () => {
    const title = newSub.trim();
    if (!title) return;
    set({ subtasks: [...form.subtasks, { id: newSubId(), title, done: false, assigneeId: null, date: null }] });
    setNewSub("");
  };
  const patchSub = (id, patch) => set({ subtasks: form.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  // проект → підставляємо його PM, якщо PM ще не вибрано
  const pickProject = (value) => {
    const projectId = value ? Number(value) : null;
    set({ projectId, pmId: form.pmId ?? (projectId ? projectById[projectId]?.pmId ?? null : null) });
  };

  const save = async () => {
    if (!form.title.trim()) return setError(t("Напишите название задачи"));
    const due = new Date(form.due);
    if (!form.due || Number.isNaN(due.getTime())) return setError(t("Укажите дедлайн"));
    if (form.startAt && form.startAt > form.due.slice(0, 10)) return setError(t("Дата старта позже дедлайна"));
    const html = editorRef.current.innerHTML;
    const body = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: isBlankHtml(html) ? "" : sanitizeHtml(html),
      status: form.status,
      projectId: form.projectId,
      pmId: form.pmId,
      leadId: form.leadId,
      assigneeId: form.assigneeId,
      priority: form.priority,
      startAt: form.startAt || null,
      dueAt: due.toISOString(),
      watchers: form.watchers.filter((id) => id !== form.assigneeId),
      subtasks: form.subtasks,
      call: form.call,
    };
    setBusy(true);
    setError("");
    try {
      if (task) {
        await update(task.id, body);
      } else {
        const created = await create({ ...body, timeSpent: draftTotal(draftTimer) });
        for (const c of draftComments) await comment(created.id, c.text, c.mentions);
        for (const file of draftFiles) await addFile(created.id, file);
      }
      onClose();
    } catch (saveError) {
      setError(saveError.message);
      setBusy(false);
    }
  };

  const canDelete = task && (can(user, "manage") || task.createdBy?.userId === user.id);
  const del = async () => {
    if (!window.confirm(t("Удалить задачу? Файлы задачи тоже удалятся."))) return;
    try {
      await remove(task.id);
      onClose();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const userSelect = (value, onChange, { empty = null, self = true } = {}) => (
    <select className="tm-input" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      {empty && <option value="">{empty}</option>}
      {team.map((u) => (
        <option key={u.id} value={u.id}>
          {self && u.id === user.id ? tt("{0} (я)", u.name) : u.name}
        </option>
      ))}
    </select>
  );

  return (
    <Modal title={task ? t("Редактирование задачи") : t("Новая задача")} onClose={onClose} className="task-modal">
      <fieldset className="task-modal__body" disabled={busy}>
        <input
          className="tm-input tm-input--top tm-input--title"
          list="task-titles"
          placeholder={t("Название задачи")}
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
          placeholder={t("Краткое описание / подзаголовок")}
          value={form.subtitle}
          onChange={(e) => set({ subtitle: e.target.value })}
        />

        <div className="tm-label">{t("Описание задачи")}</div>
        <RichEditor initial={task?.description || ""} ref={editorRef} />

        <label className="tm-field">
          <span className="tm-label">{t("Статус")}</span>
          <select className="tm-input" value={form.status} onChange={(e) => set({ status: e.target.value })}>
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="tm-grid">
          <label className="tm-field">
            <span className="tm-label">{t("Проект")}</span>
            <select className="tm-input" value={form.projectId ?? ""} onChange={(e) => pickProject(e.target.value)}>
              <option value="">{t("— без проекта —")}</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="tm-field">
            <span className="tm-label">{t("Проект-менеджер")}</span>
            {userSelect(form.pmId, (pmId) => set({ pmId }), { empty: t("— не назначен —"), self: false })}
          </label>
          <label className="tm-field">
            <span className="tm-label">{t("Ответственный")}</span>
            {userSelect(form.assigneeId, (assigneeId) => set({ assigneeId }))}
          </label>
          <label className="tm-field">
            <span className="tm-label">{t("Приоритет")}</span>
            <select className="tm-input" value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tm-field">
            <span className="tm-label">{t("Дата старта")}</span>
            <input className="tm-input" type="date" value={form.startAt || ""} onChange={(e) => set({ startAt: e.target.value })} />
          </label>
          <label className="tm-field">
            <span className="tm-label">{t("Дедлайн")}</span>
            <input className="tm-input" type="datetime-local" value={form.due} onChange={(e) => set({ due: e.target.value })} />
          </label>
        </div>
        <div className="tm-term">{t("Срок:")}{" "}<b>{dayDispShort(form.startAt)}</b> — <b>{form.due ? `${dayDispShort(form.due.slice(0, 10))} ${form.due.slice(11, 16)}` : "—"}</b>
          <span className="faint">{" "}{t("· в дедлайн придёт напоминание в Telegram")}</span>
        </div>
        <div className="tm-presets">
          {DUE_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="tm-chip" onClick={() => set({ due: toLocalInput(preset.get()) })}>
              {preset.label}
            </button>
          ))}
        </div>

        {can(user, "leads") && (
          <label className="tm-field">
            <span className="tm-label">{t("Заявка из CRM")}</span>
            <select className="tm-input" value={form.leadId ?? ""} onChange={(e) => set({ leadId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("— без заявки —")}</option>
              {leadOptions.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  #{lead.id} {leadName(lead)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="tm-label">{t("Доп. ответственные")}</div>
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

        <div className="tm-label">{t("Подзадачи")}</div>
        {form.subtasks.length > 0 && (
          <div className="tm-subs">
            {form.subtasks.map((sub) => (
              <div key={sub.id} className={`tm-sub ${sub.done ? "is-done" : ""}`}>
                <div className="tm-sub__row">
                  <button
                    type="button"
                    className="tm-sub__check"
                    aria-label={sub.done ? t("Не выполнено") : t("Выполнено")}
                    onClick={() => patchSub(sub.id, { done: !sub.done })}
                  >
                    {sub.done && "✓"}
                  </button>
                  <span className="tm-sub__title">{sub.title}</span>
                  <button
                    type="button"
                    className="tm-sub__del"
                    aria-label={t("Удалить подзадачу")}
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
                    <option value="">{t("— ответственный —")}</option>
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
            placeholder={t("Новая подзадача…")}
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSub();
              }
            }}
          />
          <button type="button" className="tm-btn" onClick={addSub}>{t("+ Добавить")}</button>
        </div>

        <div className="tm-label">{t("Таймер задачи")}</div>
        <TaskTimer task={task} draft={draftTimer} setDraft={setDraftTimer} />

        <div className="tm-label">{t("Вложения и действия")}</div>
        <TaskFiles task={task} drafts={draftFiles} setDrafts={setDraftFiles} call={form.call} onToggleCall={() => set({ call: !form.call })} />

        <div className="tm-label">{t("Комментарии")}</div>
        <TaskComments task={task} drafts={draftComments} setDrafts={setDraftComments} />

        {task && (
          <div className="tm-info">{t("Создал(а)")}{" "}{task.createdBy?.name || "—"} · {timeOf(task.createdAt)}
            {task.doneBy && tt(" · закрыл(а) {0}", task.doneBy.name)}
            {task.assigneeId && !userById[task.assigneeId]?.telegram && t(" · у ответственного не подключён Telegram")}
          </div>
        )}

        {error && <div className="alert">⚠ {error}</div>}

        <div className="tm-actions">
          <button type="button" className="tm-save" onClick={save}>
            {busy ? t("Сохраняем…") : task ? t("Сохранить") : t("Создать")}
          </button>
          <button type="button" className="tm-btn" onClick={onClose}>{t("Отмена")}</button>
          {canDelete && (
            <button type="button" className="tm-btn tm-btn--danger" onClick={del} aria-label={t("Удалить задачу")} title={t("Удалить")}>
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
        <p className="lead-modal__hint">{t("Задач нет. Например: «Перезвонить завтра в 10:00» — напоминание придёт в Telegram.")}</p>
      )}
      <button
        type="button"
        className="tboard__quick"
        onClick={() => setModal({ defaults: { leadId: lead.id, assigneeId: lead.managerId ?? undefined, title: t("Перезвонить") } })}
      >
        <span>+</span>{t("Задача")}</button>
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
