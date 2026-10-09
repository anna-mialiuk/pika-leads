import { useCallback, useEffect, useState } from "react";

import { TasksHeader, useTaskModal } from "../components/TasksShell";
import { Modal } from "../components/ui";
import { api, fileIcon, fileUrl, formatSize, upload } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useProjects } from "../lib/projects";
import { useTasks } from "../lib/tasks";

import "../components/Projects.css";
import "./FilesPage.css";
import { t, tt } from "../lib/i18n";

const TYPES = {
  doc: { icon: "📄", label: "Google Docs", color: "#5b9bff", create: "https://docs.new", hint: t("Новый документ открылся в соседней вкладке. Назовите его и вставьте сюда ссылку.") },
  sheet: { icon: "📊", label: "Google Sheets", color: "#4fd88a", create: "https://sheets.new", hint: t("Новая таблица открылась в соседней вкладке. Назовите её и вставьте сюда ссылку.") },
  folder: {
    icon: "📁",
    label: t("Папка"),
    color: "#FFC629",
    create: "https://drive.google.com/drive/my-drive",
    hint: t("Google Drive открылся в соседней вкладке: создайте папку («Создать → Папка»), откройте её и вставьте сюда ссылку."),
  },
  drive: { icon: "💾", label: "Google Drive", color: "#b98bff", create: null, hint: t("Вставьте ссылку на файл или папку в Google Drive.") },
  attach: { icon: "📎", label: t("Из задачи"), color: "#f0883e" },
  upload: { icon: null, label: t("Файл"), color: "#4fd8c8" },
};

/** Тип посилання за адресою (якщо вставили не з тієї кнопки) */
const typeFromUrl = (url, fallback) => {
  if (/docs\.google\.com\/document/.test(url)) return "doc";
  if (/docs\.google\.com\/spreadsheets/.test(url)) return "sheet";
  if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders/.test(url)) return "folder";
  return fallback;
};

function LinkModal({ type: initialType, projectId, onClose, onSaved }) {
  const { projects } = useProjects();
  const [form, setForm] = useState({ name: "", url: "", projectId: projectId || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = TYPES[initialType];
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setError("");
    if (!form.name.trim()) return setError(t("Укажите название"));
    if (!/^https:\/\//i.test(form.url.trim())) return setError(t("Вставьте ссылку, начинающуюся с https://"));
    setBusy(true);
    try {
      await api("/links", {
        method: "POST",
        body: { type: typeFromUrl(form.url, initialType), name: form.name.trim(), url: form.url.trim(), projectId: form.projectId || null },
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`${meta.icon} ${meta.label}`} onClose={onClose} className="task-modal proj-modal">
      <fieldset className="task-modal__body" disabled={busy}>
        <p className="fl-hint">{meta.hint}</p>
        <input className="tm-input tm-input--top pm-big" placeholder={t("Название")} value={form.name} autoFocus onChange={(e) => set({ name: e.target.value })} />
        <input
          className="tm-input tm-input--top mono"
          placeholder="https://docs.google.com/…"
          value={form.url}
          onChange={(e) => set({ url: e.target.value })}
        />
        <label className="tm-field">
          <span className="tm-label">{t("Проект")}</span>
          <select className="tm-input" value={form.projectId} onChange={(e) => set({ projectId: e.target.value ? Number(e.target.value) : "" })}>
            <option value="">{t("— без проекта —")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {error && <div className="alert">⚠ {error}</div>}
        <div className="tm-actions">
          <button type="button" className="tm-save pm-save" onClick={save}>
            {busy ? t("Сохраняем…") : t("Добавить")}
          </button>
          <button type="button" className="tm-btn" onClick={onClose}>{t("Отмена")}</button>
        </div>
      </fieldset>
    </Modal>
  );
}

/** Файли (як у макеті): усе з задач і проектів + посилання на Google Docs / Sheets / папки */
function FilesPage() {
  const { user } = useAuth();
  const { projects, byId: projectById, reload: reloadProjects } = useProjects();
  const { tasks, reload: reloadTasks } = useTasks();
  const { modal: taskModal, openTask } = useTaskModal();
  const [files, setFiles] = useState(null);
  const [filter, setFilter] = useState("all");
  const [linkModal, setLinkModal] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      api("/files")
        .then(({ files: list }) => setFiles(list))
        .catch((e) => setError(e.message)),
    [],
  );

  // файли з задач змінюються у вікні задачі — перечитуємо разом із задачами
  useEffect(() => {
    load();
  }, [load, tasks]);

  const create = (type) => {
    if (TYPES[type].create) window.open(TYPES[type].create, "_blank", "noopener");
    setLinkModal({ type });
  };

  const pick = async (event) => {
    const picked = [...(event.target.files || [])];
    event.target.value = "";
    setError("");
    const projectId = Number(filter) || null;
    for (const file of picked) {
      setUploading((n) => n + 1);
      try {
        await upload(`/files${projectId ? `?project=${projectId}` : ""}`, file);
      } catch (e) {
        setError(e.message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    load();
    if (projectId) reloadProjects();
  };

  const remove = async (f) => {
    if (!window.confirm(tt("Удалить «{0}»?", f.name))) return;
    setError("");
    try {
      await api(f.kind === "link" ? `/links/${f.id}` : `/files/${f.id}`, { method: "DELETE" });
      await load();
      if (f.projectId) reloadProjects();
      if (f.kind === "attach") reloadTasks();
    } catch (e) {
      setError(e.message);
    }
  };

  const list = (files || []).filter((f) => (filter === "all" ? true : filter === "none" ? !f.projectId : f.projectId === Number(filter)));

  return (
    <div className="tboard-page">
      <TasksHeader />

      <div className="fl-gbar">
        <div className="fl-gbar__info">
          <span>💾</span>
          <div>
            <div className="fl-gbar__title">{t("Интеграция с Google Workspace")}</div>
            <div className="fl-gbar__status">{t("● Документы создаются в вашем Google-аккаунте и хранятся там")}</div>
          </div>
        </div>
        <a className="fl-gbar__btn" href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer">{t("Открыть Google Drive")}</a>
      </div>

      <div className="fl-tools">
        <button type="button" onClick={() => create("doc")}>
          📄 Google Docs
        </button>
        <button type="button" onClick={() => create("sheet")}>
          📊 Google Sheets
        </button>
        <button type="button" onClick={() => create("folder")}>{t("📁 Папка")}</button>
        <button type="button" onClick={() => setLinkModal({ type: "drive" })}>{t("🔗 Ссылка")}</button>
        <label className="fl-tools__upload">
          {uploading ? t("Загружаем…") : t("⬆ Загрузить файл")}
          <input type="file" multiple hidden onChange={pick} />
        </label>
        <div className="fl-tools__filter">
          <span>{t("Проект:")}</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">{t("Все проекты")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="none">{t("Без проекта")}</option>
          </select>
        </div>
      </div>

      {error && <div className="alert">⚠ {error}</div>}

      <div className="fl-table">
        <div className="fl-row fl-row--head">
          <div>{t("Название")}</div>
          <div>{t("Тип")}</div>
          <div>{t("Владелец")}</div>
          <div>{t("Проект")}</div>
          <div />
        </div>
        {files === null && (
          <div className="content-loading">
            <div className="spinner" />
          </div>
        )}
        {files && list.length === 0 && <div className="fl-empty">{t("Файлов пока нет. Создайте документ, таблицу или загрузите файл.")}</div>}
        {list.map((f) => {
          const kind = f.kind === "link" ? f.type : f.kind;
          const meta = TYPES[kind] || TYPES.upload;
          const project = f.projectId ? projectById[f.projectId] : null;
          const task = f.taskId ? tasks.find((t) => t.id === f.taskId) : null;
          const canDelete = f.kind !== "attach" && (user.role === "admin" || f.byId === user.id);
          return (
            <div key={`${f.kind}${f.id}`} className="fl-row">
              <div className="fl-name">
                <span className="fl-name__icon">{meta.icon || fileIcon(f.name)}</span>
                <div>
                  {f.kind === "link" ? (
                    <a href={f.url} target="_blank" rel="noopener noreferrer">
                      {f.name}
                    </a>
                  ) : (
                    <a href={fileUrl(f.id)} download={f.name}>
                      {f.name}
                    </a>
                  )}
                  <div className="fl-name__sub">
                    {f.kind === "attach" && (
                      <button type="button" onClick={() => task && openTask(task)}>{t("задача:")}{" "}{f.taskTitle}
                      </button>
                    )}
                    {f.size ? <span>{formatSize(f.size)}</span> : null}
                    <span className="fl-mobile-only">
                      {meta.label} · {f.by}
                      {project ? ` · ${project.name}` : ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className="fl-type" style={{ color: meta.color }}>
                {meta.label}
              </div>
              <div className="fl-muted">{f.by || "—"}</div>
              <div className="fl-muted">
                {project ? (
                  <span className="fl-project">
                    <i style={{ background: project.color }} />
                    {project.name}
                  </span>
                ) : (
                  "—"
                )}
              </div>
              <div className="fl-del">
                {canDelete && (
                  <button type="button" title={t("Удалить")} aria-label={t("Удалить")} onClick={() => remove(f)}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="tboard-note">{t("Здесь всё вместе: вложения задач, файлы проектов и ссылки на Google-документы. Файл с выбранным проектом попадает в «Файлы проекта».")}</div>

      {linkModal && (
        <LinkModal type={linkModal.type} projectId={Number(filter) || null} onClose={() => setLinkModal(null)} onSaved={load} />
      )}
      {taskModal}
    </div>
  );
}

export default FilesPage;
