import { useState } from "react";

import { Modal } from "./ui";
import { fileIcon, fileUrl, formatSize } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useMeta } from "../lib/meta";
import {
  CALL_SERVICES,
  PROJECT_COLORS,
  PROJECT_ICONS,
  PROJECT_STATUS,
  dayDisp,
  initials,
  todayIso,
  useProjects,
} from "../lib/projects";
import { formatShort, isOverdue, useColumns, useTasks } from "../lib/tasks";

import "./Projects.css";
import { t, tt, LOCALE } from "../lib/i18n";
import { ROLE_LABELS, can } from "../lib/roles";
import { ink } from "../lib/theme";


export const canManageProject = (p, user) => can(user, "manage") || p.pmId === user.id || p.createdBy?.userId === user.id;

/* ================= створення / редагування проекту ================= */

function PersonRow({ user: u, on, tag, tone, onToggle }) {
  return (
    <button type="button" className={`pm-person ${on ? "is-on" : ""}`} onClick={onToggle} aria-pressed={on}>
      <span className="pm-person__check">{on && "✓"}</span>
      <span className={`pm-person__av pm-person__av--${tone}`}>{initials(u.name)}</span>
      <span className="pm-person__name">{u.name}</span>
      {tag && <span className="pm-person__tag">{tag}</span>}
    </button>
  );
}

function YesNo({ value, onChange }) {
  return (
    <div className="pm-yesno">
      <button type="button" className={value ? "is-yes" : ""} onClick={() => onChange(true)}>{t("Да")}</button>
      <button type="button" className={!value ? "is-no" : ""} onClick={() => onChange(false)}>{t("Нет")}</button>
    </div>
  );
}

export function ProjectModal({ project = null, onClose, onSaved }) {
  const { user } = useAuth();
  const { users } = useMeta();
  const { create, update } = useProjects();
  const team = users.filter((u) => !u.disabled);
  const [form, setForm] = useState(() => ({
    name: project?.name ?? "",
    client: project?.client ?? "",
    pmId: project?.pmId ?? user.id,
    buyers: project?.buyers ?? [],
    members: project?.members ?? [],
    hasChat: project?.hasChat ?? true,
    hasFolder: project?.hasFolder ?? true,
    startAt: project?.startAt ?? todayIso(),
    endAt: project?.endAt ?? "",
    status: project?.status ?? "active",
    color: project?.color ?? PROJECT_COLORS[0],
    icon: project?.icon ?? PROJECT_ICONS[0],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const toggle = (key, id) => set({ [key]: form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id] });

  const isBuyer = (u) => u.role === "buyer" || u.position === "Байер";
  const buyers = team.filter(isBuyer);
  const others = team.filter((u) => !isBuyer(u));

  const save = async () => {
    if (!form.name.trim()) return setError(t("Укажите название проекта"));
    if (form.startAt && form.endAt && form.endAt < form.startAt) return setError(t("Завершение раньше старта"));
    setBusy(true);
    setError("");
    try {
      const body = { ...form, name: form.name.trim(), client: form.client.trim(), startAt: form.startAt || null, endAt: form.endAt || null };
      const saved = project ? await update(project.id, body) : await create(body);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={project ? t("Редактирование проекта") : t("Новый проект")} onClose={onClose} className="task-modal proj-modal">
      <fieldset className="task-modal__body" disabled={busy}>
        <input
          className="tm-input tm-input--top pm-big"
          placeholder={t("Название проекта")}
          value={form.name}
          autoFocus={!project}
          onChange={(e) => set({ name: e.target.value })}
        />
        <input className="tm-input tm-input--top pm-big" placeholder={t("Ниша / клиент")} value={form.client} onChange={(e) => set({ client: e.target.value })} />

        <label className="tm-field">
          <span className="tm-label">{t("Проект-менеджер")}</span>
          <select className="tm-input" value={form.pmId ?? ""} onChange={(e) => set({ pmId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t("— не назначен —")}</option>
            {team.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <div className="tm-label">{t("Байеры на проекте")}</div>
        <div className="pm-people">
          {buyers.length === 0 && <div className="pm-hint">{t("Нет сотрудников с должностью «Байер» — укажите её в разделе «Команда».")}</div>}
          {buyers.map((u) => (
            <PersonRow key={u.id} user={u} tone="buyer" tag={u.platform} on={form.buyers.includes(u.id)} onToggle={() => toggle("buyers", u.id)} />
          ))}
        </div>

        <div className="tm-label">{t("Команда проекта")}</div>
        <div className="pm-people">
          {others.map((u) => (
            <PersonRow
              key={u.id}
              user={u}
              tone="member"
              tag={u.position ? t(u.position) : ROLE_LABELS[u.role]}
              on={form.members.includes(u.id)}
              onToggle={() => toggle("members", u.id)}
            />
          ))}
        </div>

        <div className="tm-grid">
          <div className="tm-field">
            <span className="tm-label">{t("💬 Чат проекта")}</span>
            <YesNo value={form.hasChat} onChange={(hasChat) => set({ hasChat })} />
          </div>
          <div className="tm-field">
            <span className="tm-label">{t("📁 Папка проекта")}</span>
            <YesNo value={form.hasFolder} onChange={(hasFolder) => set({ hasFolder })} />
          </div>
          <label className="tm-field">
            <span className="tm-label">{t("Старт")}</span>
            <input className="tm-input" type="date" value={form.startAt || ""} onChange={(e) => set({ startAt: e.target.value })} />
          </label>
          <label className="tm-field">
            <span className="tm-label">{t("Завершение")}</span>
            <input className="tm-input" type="date" value={form.endAt || ""} onChange={(e) => set({ endAt: e.target.value })} />
          </label>
        </div>

        <div className="tm-label pm-gap">{t("Статус")}</div>
        <div className="pm-pills">
          {Object.entries(PROJECT_STATUS).map(([key, s]) => (
            <button key={key} type="button" className={form.status === key ? "is-on" : ""} onClick={() => set({ status: key })}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="tm-label">{t("Цвет проекта")}</div>
        <div className="pm-colors">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={tt("Цвет {0}", c)}
              aria-pressed={form.color === c}
              style={{ background: c, boxShadow: form.color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : "none" }}
              onClick={() => set({ color: c })}
            />
          ))}
        </div>

        <div className="tm-label">{t("Иконка проекта")}</div>
        <div className="pm-icons">
          {PROJECT_ICONS.map((ic) => (
            <button key={ic} type="button" className={form.icon === ic ? "is-on" : ""} onClick={() => set({ icon: ic })}>
              {ic}
            </button>
          ))}
        </div>

        {error && <div className="alert">⚠ {error}</div>}

        <div className="tm-actions">
          <button type="button" className="tm-save pm-save" onClick={save}>
            {busy ? t("Сохраняем…") : project ? t("Сохранить") : t("Создать")}
          </button>
          <button type="button" className="tm-btn" onClick={onClose}>{t("Отмена")}</button>
        </div>
      </fieldset>
    </Modal>
  );
}

/* ================= історія созвонів ================= */

function CallCard({ project, call, canManage, canDelete }) {
  const { updateCall, removeCall } = useProjects();
  const service = CALL_SERVICES[call.service] || { label: call.service, color: "#8a8f98" };
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(call.summary);
  const [recording, setRecording] = useState(call.recording);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    try {
      await updateCall(project.id, call.id, { summary, recording });
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="pd-call" style={{ "--svc": service.color }}>
      <div className="pd-call__head">
        <div className="pd-call__main">
          <div className="pd-call__title">
            <span>{call.title}</span>
            <span className="pd-call__svc">{service.label}</span>
          </div>
          <div className="pd-call__meta">
            <span>{dayDisp(call.date)}</span>
            {call.duration && <span>⏱ {call.duration}</span>}
            {call.by?.name && <span>{call.by.name}</span>}
          </div>
        </div>
        <div className="pd-call__tools">
          <button
            type="button"
            title={call.pinned ? t("Открепить") : t("Закрепить")}
            onClick={() => updateCall(project.id, call.id, { pinned: !call.pinned }).catch((e) => setError(e.message))}
          >
            {call.pinned ? "📌" : "📍"}
          </button>
          {canDelete && (
            <button
              type="button"
              title={t("Удалить")}
              className="is-del"
              onClick={() => window.confirm(t("Удалить созвон?")) && removeCall(project.id, call.id).catch((e) => setError(e.message))}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {call.recording && !editing && (
        <a className="pd-call__rec" href={call.recording} target="_blank" rel="noopener noreferrer">{t("📹 Запись созвона")}</a>
      )}

      {editing ? (
        <div>
          <div className="pd-call__label">{t("Саммери созвона")}</div>
          <textarea
            className="tm-input pd-call__textarea"
            value={summary}
            placeholder={t("О чём договорились, задачи, ответственные, следующие шаги…")}
            onChange={(e) => setSummary(e.target.value)}
          />
          <input
            className="tm-input pd-call__recinput"
            value={recording}
            placeholder={t("Ссылка на запись (Zoom / Google Drive / Loom)")}
            onChange={(e) => setRecording(e.target.value)}
          />
          <div className="pd-row-btns">
            <button type="button" className="pd-btn-yellow" onClick={save}>{t("Сохранить")}</button>
            <button
              type="button"
              className="tm-btn"
              onClick={() => {
                setEditing(false);
                setSummary(call.summary);
                setRecording(call.recording);
              }}
            >{t("Отмена")}</button>
          </div>
        </div>
      ) : (
        <div className="pd-call__summary">
          <div className={call.summary ? "" : "is-empty"}>{call.summary || t("Саммери ещё не заполнено")}</div>
          {canManage && (
            <button type="button" onClick={() => setEditing(true)}>
              {call.summary ? t("✎ Редактировать саммери") : t("✎ Написать саммери")}
            </button>
          )}
        </div>
      )}
      {error && <div className="field-error">⚠ {error}</div>}
    </div>
  );
}

function CallForm({ project, onDone }) {
  const { addCall } = useProjects();
  const [form, setForm] = useState({ title: "", date: todayIso(), service: "zoom", duration: "", recording: "" });
  const [error, setError] = useState("");
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const save = async () => {
    if (!form.title.trim()) return setError(t("Укажите тему созвона"));
    setError("");
    try {
      await addCall(project.id, form);
      onDone();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="pd-callform">
      <input className="tm-input" placeholder={t("Тема созвона")} value={form.title} autoFocus onChange={(e) => set({ title: e.target.value })} />
      <div className="pd-callform__grid">
        <input className="tm-input" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
        <select className="tm-input" value={form.service} onChange={(e) => set({ service: e.target.value })}>
          {Object.entries(CALL_SERVICES).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
        <input className="tm-input" placeholder={t("Длит. (35 мин)")} value={form.duration} onChange={(e) => set({ duration: e.target.value })} />
      </div>
      <input
        className="tm-input"
        placeholder={t("Ссылка на запись (необязательно)")}
        value={form.recording}
        onChange={(e) => set({ recording: e.target.value })}
      />
      {error && <div className="field-error">⚠ {error}</div>}
      <div className="pd-row-btns">
        <button type="button" className="pd-btn-yellow" onClick={save}>{t("Добавить")}</button>
        <button type="button" className="tm-btn" onClick={onDone}>{t("Отмена")}</button>
      </div>
    </div>
  );
}

/* ================= картка проекту ================= */

export function ProjectDetail({ projectId, onClose, onEdit, onOpenTask, onNewTask }) {
  const { user } = useAuth();
  const { userById } = useMeta();
  const { byId, addFile, removeFile } = useProjects();
  const { tasks } = useTasks();
  const { columns: TASK_COLUMNS, byKey: COLUMN_BY_KEY } = useColumns();
  const [callForm, setCallForm] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  const p = byId[projectId];
  if (!p) return null;

  const status = PROJECT_STATUS[p.status] || PROJECT_STATUS.active;
  const pTasks = tasks.filter((t) => t.projectId === p.id).sort((a, b) => Number(a.done) - Number(b.done) || new Date(a.dueAt) - new Date(b.dueAt));
  const count = (key) => pTasks.filter((t) => t.status === key).length;
  const done = count("done");
  const active = pTasks.filter((t) => !t.done).length;
  const overdue = pTasks.filter(isOverdue).length;
  const progress = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
  const canManage = canManageProject(p, user);
  const canDelete = can(user, "manage");

  let tlPct = 0;
  let tlLabel = "—";
  if (p.startAt && p.endAt) {
    const st = new Date(`${p.startAt}T00:00`).getTime();
    const en = new Date(`${p.endAt}T00:00`).getTime();
    tlPct = en > st ? Math.max(0, Math.min(100, Math.round(((now - st) / (en - st)) * 100))) : 100;
    const daysLeft = Math.ceil((en - now) / 864e5);
    tlLabel = daysLeft > 0 ? tt("осталось {0} дн.", daysLeft) : daysLeft === 0 ? t("дедлайн сегодня") : tt("просрочен на {0} дн.", -daysLeft);
  }

  const team = [
    ...p.buyers.map((id) => ({ id, tag: userById[id]?.platform || t("Байер"), tone: "buyer" })),
    ...p.members.map((id) => ({ id, tag: (userById[id]?.position && t(userById[id].position)) || ROLE_LABELS[userById[id]?.role] || "", tone: "member" })),
  ].filter((m) => userById[m.id]);

  const upload = async (event) => {
    const picked = [...(event.target.files || [])];
    event.target.value = "";
    setError("");
    for (const file of picked) {
      setUploading((n) => n + 1);
      try {
        await addFile(p.id, file);
      } catch (e) {
        setError(e.message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  return (
    <Modal title="" onClose={onClose} className="pd-modal">
      <div className="pd-head">
        <div className="pd-head__row">
          <span className="pd-head__color" style={{ background: p.color, boxShadow: `0 0 12px ${p.color}` }} />
          <div className="pd-head__name">{p.name}</div>
          <span className="pd-status" style={{ background: status.bg, color: ink(status.color) }}>
            {status.label}
          </span>
          {canManage && (
            <button type="button" className="pd-edit" onClick={onEdit}>
              <span>✎</span>
              <span className="pd-edit__label">{t("Редактировать")}</span>
            </button>
          )}
        </div>
        <div className="pd-head__meta">
          <span>{t("Ниша:")}{" "}<b>{p.client || "—"}</b>
          </span>
          <span>
            PM: <b>{userById[p.pmId]?.name || "—"}</b>
          </span>
          <span>{t("Срок:")}{" "}
            <b className="mono">
              {dayDisp(p.startAt)} — {dayDisp(p.endAt)}
            </b>
          </span>
        </div>
      </div>

      <div className="pd-body">
        <div className="pd-kpis">
          <div>
            <span>{t("Всего задач")}</span>
            <b>{pTasks.length}</b>
          </div>
          <div>
            <span>{t("Готово")}</span>
            <b style={{ color: "var(--green-ink)" }}>{done}</b>
          </div>
          <div>
            <span>{t("В работе")}</span>
            <b style={{ color: "var(--accent-ink)" }}>{active}</b>
          </div>
          <div>
            <span>{t("Просрочено")}</span>
            <b style={{ color: "var(--red-ink)" }}>{overdue}</b>
          </div>
          <div>
            <span>{t("Прогресс")}</span>
            <b style={{ color: "var(--accent)" }}>{progress}%</b>
          </div>
        </div>

        <div className="pd-card">
          <div className="pd-card__head">
            <div className="pd-card__title">{t("Таймлайн проекта")}</div>
            <div className="pd-tl-label">{tlLabel}</div>
          </div>
          <div className="pd-tl">
            <div style={{ width: `${tlPct}%`, background: `linear-gradient(90deg, ${p.color}, #FFC629)` }} />
          </div>
          <div className="pd-tl-dates">
            <span>{dayDisp(p.startAt)}</span>
            <span>{dayDisp(p.endAt)}</span>
          </div>
        </div>

        <div className="pd-card">
          <div className="pd-card__head">
            <div className="pd-card__title">{t("Команда проекта")}</div>
            <div className="pd-badges">
              <span style={{ color: p.hasChat ? "var(--green-ink)" : "var(--muted)" }}>{p.hasChat ? t("💬 Чат создан") : t("💬 Без чата")}</span>
              <span style={{ color: p.hasFolder ? "var(--green-ink)" : "var(--muted)" }}>{p.hasFolder ? t("📁 Папка создана") : t("📁 Без папки")}</span>
            </div>
          </div>
          {team.length ? (
            <div className="pd-team">
              {team.map((m) => (
                <div key={`${m.tone}${m.id}`} className={`pd-team__item pd-team__item--${m.tone}`}>
                  <span className="pd-team__av">{initials(userById[m.id].name)}</span>
                  <span className="pd-team__name">{userById[m.id].name}</span>
                  {m.tag && <span className="pd-team__tag">{m.tag}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="pd-muted">{t("Команда не назначена — откройте «Редактировать», чтобы добавить байеров и участников.")}</div>
          )}
        </div>

        <div className="pd-split">
          <div>
            <div className="pd-section-title">{t("Задачи по статусам")}</div>
            <div className="pd-stats">
              {TASK_COLUMNS.map((c) => {
                const n = count(c.key);
                return (
                  <div key={c.key}>
                    <div className="pd-stats__row">
                      <span>
                        <i style={{ background: c.color }} />
                        {c.label}
                      </span>
                      <b>{n}</b>
                    </div>
                    <div className="pd-stats__bar">
                      <div style={{ width: `${pTasks.length ? Math.round((n / pTasks.length) * 100) : 0}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="pd-section-title pd-section-title--row">{t("Задачи проекта")}<button type="button" className="pd-link" onClick={onNewTask}>{t("＋ Задача")}</button>
            </div>
            <div className="pd-tasks">
              {pTasks.length === 0 && <div className="pd-empty">{t("Задач в проекте пока нет.")}</div>}
              {pTasks.map((t) => (
                <button key={t.id} type="button" className="pd-task" onClick={() => onOpenTask(t)}>
                  <i style={{ background: COLUMN_BY_KEY[t.status]?.color }} />
                  <div>
                    <div className="pd-task__title">{t.title}</div>
                    <div className="pd-task__sub">
                      {userById[t.assigneeId]?.name || "—"} · {COLUMN_BY_KEY[t.status]?.label}
                    </div>
                  </div>
                  <span className={isOverdue(t) ? "is-overdue" : ""}>{formatShort(t.dueAt)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pd-section">
          <div className="pd-section-title pd-section-title--row">{t("История созвонов")}<button type="button" className="pd-link" onClick={() => setCallForm(true)}>{t("＋ Добавить созвон")}</button>
          </div>
          {callForm && <CallForm project={p} onDone={() => setCallForm(false)} />}
          {p.calls.length ? (
            <div className="pd-calls">
              {p.calls.map((c) => (
                <CallCard key={`${c.id}${c.updatedAt || ""}`} project={p} call={c} canManage canDelete={canDelete || c.by?.userId === user.id} />
              ))}
            </div>
          ) : (
            !callForm && <div className="pd-empty">{t("Созвонов пока нет. Добавьте первый и запишите саммери.")}</div>
          )}
        </div>

        <div className="pd-section">
          <div className="pd-section-title pd-section-title--row">{t("Файлы проекта")}<label className="pd-link">
              {uploading ? t("Загружаем…") : t("＋ Добавить файл")}
              <input type="file" multiple hidden onChange={upload} />
            </label>
          </div>
          {error && <div className="field-error">⚠ {error}</div>}
          {p.files.length ? (
            <div className="pd-files">
              {p.files.map((f) => (
                <div key={f.id} className="pd-file">
                  <span className="pd-file__icon">{fileIcon(f.name)}</span>
                  <div>
                    <a href={fileUrl(f.id)} download={f.name} className="pd-file__name">
                      {f.name}
                    </a>
                    <div className="pd-file__meta">
                      {formatSize(f.size)} · {f.by} · {new Date(f.at).toLocaleDateString(LOCALE)}
                    </div>
                  </div>
                  {(canManage || f.byId === user.id) && (
                    <button
                      type="button"
                      title={t("Удалить")}
                      onClick={() => window.confirm(tt("Удалить «{0}»?", f.name)) && removeFile(f.id).catch((e) => setError(e.message))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="pd-empty">{t("Файлов пока нет. Прикрепите брифы, медиапланы, макеты.")}</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
