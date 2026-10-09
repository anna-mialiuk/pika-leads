import { useState } from "react";

import { TaskForm, TaskItem } from "../components/Tasks";
import { useAuth } from "../lib/auth";
import { groupTasks, useTasks } from "../lib/tasks";

import "./Content.css";

const GROUPS = [
  { key: "overdue", label: "Просрочено" },
  { key: "today", label: "Сегодня" },
  { key: "tomorrow", label: "Завтра" },
  { key: "later", label: "Позже" },
  { key: "done", label: "Выполнено за неделю" },
];

/** Задачі: мої / всі, згруповані за терміном */
function TasksPage() {
  const { user } = useAuth();
  const { tasks, loaded } = useTasks();
  const [scope, setScope] = useState("mine");
  const [adding, setAdding] = useState(false);

  const list = scope === "mine" ? tasks.filter((t) => t.assigneeId === user.id) : tasks;
  const groups = groupTasks(list);
  const open = list.filter((t) => !t.done).length;

  return (
    <div className="content-page tasks-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Задачи {loaded && <span className="faint">{open}</span>}</h1>
          <p className="page-text">Звонки и дела по заявкам. В срок приходит напоминание в Telegram.</p>
        </div>
        <div className="leads__head-actions">
          <div className="segmented">
            <button type="button" className={scope === "mine" ? "is-active" : ""} onClick={() => setScope("mine")}>
              Мои
            </button>
            <button type="button" className={scope === "all" ? "is-active" : ""} onClick={() => setScope("all")}>
              Все
            </button>
          </div>
          {!adding && (
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              + Задача
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div style={{ marginBottom: 16 }}>
          <TaskForm onDone={() => setAdding(false)} />
        </div>
      )}

      {!loaded && (
        <div className="content-loading">
          <div className="spinner" />
        </div>
      )}

      {loaded && !list.length && <div className="leads__empty">Задач нет. Создайте задачу здесь или в карточке заявки.</div>}

      {GROUPS.map(({ key, label }) =>
        groups[key].length ? (
          <section key={key} className={`card tasks-group tasks-group--${key}`}>
            <h2>
              {label} <span className="faint">{groups[key].length}</span>
            </h2>
            {groups[key].map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </section>
        ) : null,
      )}
    </div>
  );
}

export default TasksPage;
