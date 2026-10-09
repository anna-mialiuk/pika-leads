import { useState } from "react";

import { ProjectDetail, ProjectModal, canManageProject } from "../components/Projects";
import { TasksHeader, useTaskModal } from "../components/TasksShell";
import { useAuth } from "../lib/auth";
import { useMeta } from "../lib/meta";
import { PROJECT_STATUS, dayDisp, useProjects } from "../lib/projects";
import { useTasks } from "../lib/tasks";

import "../components/Projects.css";
import { t, tt } from "../lib/i18n";
import { can } from "../lib/roles";
import { ink } from "../lib/theme";

/** Проекти (як у макеті): картки з прогресом, клік — повна картка проекту */
function ProjectsPage() {
  const { user } = useAuth();
  const { userById } = useMeta();
  const { projects, loaded, remove } = useProjects();
  const { tasks } = useTasks();
  const { modal: taskModal, openTask, openNew } = useTaskModal();
  const [editing, setEditing] = useState(null); // {project} | {} для нового
  const [detailId, setDetailId] = useState(null);
  const [error, setError] = useState("");

  const del = (p) => {
    if (!window.confirm(tt("Удалить проект «{0}»? Задачи останутся, файлы проекта удалятся.", p.name))) return;
    setError("");
    remove(p.id).catch((e) => setError(e.message));
  };

  const sorted = projects
    .slice()
    .sort((a, b) => ["active", "paused", "done"].indexOf(a.status) - ["active", "paused", "done"].indexOf(b.status) || b.id - a.id);

  return (
    <div className="tboard-page">
      <TasksHeader action={{ label: t("+ Проект"), onClick: () => setEditing({}) }} />
      {error && <div className="alert">⚠ {error}</div>}

      {!loaded ? (
        <div className="content-loading">
          <div className="spinner" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="pd-empty pd-empty--page">{t("Проектов пока нет. Создайте первый — задачи можно будет группировать по проектам.")}</div>
      ) : (
        <div className="proj-grid">
          {sorted.map((p) => {
            const pTasks = tasks.filter((t) => t.projectId === p.id);
            const doneCount = pTasks.filter((t) => t.status === "done").length;
            const progress = pTasks.length ? Math.round((doneCount / pTasks.length) * 100) : 0;
            const status = PROJECT_STATUS[p.status] || PROJECT_STATUS.active;
            return (
              <div
                key={p.id}
                className="proj-card"
                role="button"
                tabIndex={0}
                onClick={() => setDetailId(p.id)}
                onKeyDown={(e) => e.key === "Enter" && setDetailId(p.id)}
              >
                <div className="proj-card__head">
                  <div className="proj-card__name">
                    <i style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
                    {p.name}
                  </div>
                  <div className="proj-card__tools">
                    <span className="proj-card__status" style={{ background: status.bg, color: ink(status.color) }}>
                      {status.label}
                    </span>
                    {canManageProject(p, user) && (
                      <button
                        type="button"
                        title={t("Редактировать")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing({ project: p });
                        }}
                      >
                        ✎
                      </button>
                    )}
                    {(can(user, "manage") || p.createdBy?.userId === user.id) && (
                      <button
                        type="button"
                        title={t("Удалить")}
                        className="is-del"
                        onClick={(e) => {
                          e.stopPropagation();
                          del(p);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div className="proj-card__meta">
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
                <div className="proj-card__progress-label">
                  <span>
                    {doneCount}{" "}{t("из")}{" "}{pTasks.length}{" "}{t("задач")}</span>
                  <b>{progress}%</b>
                </div>
                <div className="proj-card__bar">
                  <div style={{ width: `${progress}%`, background: p.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="tboard-note">{t("Кликните по проекту для полного управления.")}</div>

      {detailId && (
        <ProjectDetail
          projectId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => setEditing({ project: projects.find((p) => p.id === detailId) })}
          onOpenTask={openTask}
          onNewTask={() => openNew({ projectId: detailId })}
        />
      )}
      {editing && <ProjectModal project={editing.project} onClose={() => setEditing(null)} />}
      {taskModal}
    </div>
  );
}

export default ProjectsPage;
