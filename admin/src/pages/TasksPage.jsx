import { useState } from "react";

import { TaskCard } from "../components/Tasks";
import { TasksHeader, useTaskModal, useTaskScope } from "../components/TasksShell";
import { TASK_COLUMNS, isOverdue, useTasks } from "../lib/tasks";

const CLOSED_DAYS = 30; // у «Готово» / «Отклонено» показуємо закриті за останній місяць

/** Задачі — канбан як у макеті: 6 колонок, перетягування, швидке додавання */
function TasksPage() {
  const { tasks, loaded, update } = useTasks();
  const { scope, setScope, list } = useTaskScope();
  const { modal, openTask, openNew } = useTaskModal();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [error, setError] = useState("");
  const [since] = useState(() => Date.now() - CLOSED_DAYS * 864e5);

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
      <TasksHeader scope={scope} onScope={setScope} action={{ label: "+ Новая задача", onClick: () => openNew() }} />

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
                      onOpen={openTask}
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
                  <button type="button" className="tboard__quick" onClick={() => openNew({ status: col.key })}>
                    <span>+</span>Задача
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="tboard-note">Перетаскивайте карточки между колонками. Клик по карточке — редактирование.</div>

      {modal}
    </div>
  );
}

export default TasksPage;
