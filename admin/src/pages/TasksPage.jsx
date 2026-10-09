import { useState } from "react";

import { TaskCard, TaskModal } from "../components/Tasks";
import { useAuth } from "../lib/auth";
import { TASK_COLUMNS, isOverdue, useTasks } from "../lib/tasks";

import "../components/Tasks.css";

const CLOSED_DAYS = 30; // у «Готово» / «Отклонено» показуємо закриті за останній місяць

/** Задачі — канбан як у макеті: 6 колонок, перетягування, швидке додавання */
function TasksPage() {
  const { user } = useAuth();
  const { tasks, loaded, update } = useTasks();
  const [scope, setScope] = useState(() => {
    try {
      return localStorage.getItem("tasks-scope") || "all";
    } catch {
      return "all";
    }
  });
  const [modal, setModal] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [error, setError] = useState("");
  const [since] = useState(() => Date.now() - CLOSED_DAYS * 864e5);

  const chooseScope = (value) => {
    setScope(value);
    try {
      localStorage.setItem("tasks-scope", value);
    } catch {
      /* приватний режим */
    }
  };

  const mine = (t) => t.assigneeId === user.id || t.watchers.includes(user.id);
  const list = scope === "mine" ? tasks.filter(mine) : tasks;
  const overdueCount = list.filter(isOverdue).length;

  const columnTasks = (key) => {
    const items = list.filter((t) => t.status === key);
    if (key === "done" || key === "rejected") {
      return items.filter((t) => new Date(t.doneAt || t.createdAt) >= since).sort((a, b) => new Date(b.doneAt) - new Date(a.doneAt));
    }
    return items.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  };

  const drop = (key) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (!task || task.status === key) return;
    setError("");
    update(task.id, { status: key }).catch((e) => setError(e.message));
  };

  return (
    <div className="tboard-page">
      <div className="tboard-head">
        <h1 className="tboard-head__title">Задачи</h1>
        <div className="tboard-head__actions">
          <div className="segmented">
            <button type="button" className={scope === "mine" ? "is-active" : ""} onClick={() => chooseScope("mine")}>
              Мои
            </button>
            <button type="button" className={scope === "all" ? "is-active" : ""} onClick={() => chooseScope("all")}>
              Все
            </button>
          </div>
          <button type="button" className="tboard-add" onClick={() => setModal({ defaults: {} })}>
            + Новая задача
          </button>
        </div>
      </div>

      {overdueCount > 0 && <div className="tboard-overdue">⚠ Просрочено задач: {overdueCount}</div>}
      {error && <div className="alert">⚠ {error}</div>}

      {!loaded ? (
        <div className="content-loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="tboard">
          {TASK_COLUMNS.map((col) => {
            const items = columnTasks(col.key);
            return (
              <div
                key={col.key}
                className={`tboard__col ${overCol === col.key && dragId ? "is-over" : ""}`}
                style={{ "--col": col.color }}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overCol !== col.key) setOverCol(col.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(col.key);
                }}
              >
                <div className="tboard__col-head">
                  <div className="tboard__col-name">
                    <i />
                    {col.label}
                  </div>
                  <div className="tboard__count">{items.length}</div>
                </div>
                <div className="tboard__list">
                  {items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      draggable
                      onOpen={(t) => setModal({ task: t })}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(task.id));
                        setDragId(task.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                    />
                  ))}
                  <button type="button" className="tboard__quick" onClick={() => setModal({ defaults: { status: col.key } })}>
                    <span>+</span>Задача
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="tboard-note">
        Перетаскивайте карточки между колонками. Клик по карточке — редактирование. Напоминание о дедлайне приходит в Telegram.
      </div>

      {modal && <TaskModal task={modal.task} defaults={modal.defaults} onClose={() => setModal(null)} />}
    </div>
  );
}

export default TasksPage;
