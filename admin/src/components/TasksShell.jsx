import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { TaskModal } from "./Tasks";
import { useAuth } from "../lib/auth";
import { useTasks } from "../lib/tasks";

import "./Tasks.css";

/** Шапка розділу «Задачи» (як у макеті): заголовок, фільтр «Мои / Все», жовта кнопка дії */
export function TasksHeader({ scope, onScope, action }) {
  return (
    <div className="tboard-head">
      <h1 className="tboard-head__title">Задачи</h1>
      <div className="tboard-head__actions">
        {onScope && (
          <div className="segmented">
            <button type="button" className={scope === "mine" ? "is-active" : ""} onClick={() => onScope("mine")}>
              Мои
            </button>
            <button type="button" className={scope === "all" ? "is-active" : ""} onClick={() => onScope("all")}>
              Все
            </button>
          </div>
        )}
        {action && (
          <button type="button" className="tboard-add" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

/** «Мои / Все» — один вибір для дошки, Ганта й календаря */
export function useTaskScope() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const [scope, setScope] = useState(() => {
    try {
      return localStorage.getItem("tasks-scope") || "all";
    } catch {
      return "all";
    }
  });
  const choose = (value) => {
    setScope(value);
    try {
      localStorage.setItem("tasks-scope", value);
    } catch {
      /* приватний режим */
    }
  };
  const mine = (t) => t.assigneeId === user.id || t.watchers.includes(user.id) || t.pmId === user.id;
  return { scope, setScope: choose, list: scope === "mine" ? tasks.filter(mine) : tasks };
}

/**
 * Вікно задачі для сторінок розділу. Відкриту задачу видно в адресі (?task=12) —
 * так працюють посилання з Telegram.
 */
export function useTaskModal() {
  const { tasks } = useTasks();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(null);
  const openId = Number(params.get("task")) || null;
  const task = openId ? tasks.find((t) => t.id === openId) : null;

  const openTask = useCallback(
    (t) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("task", String(t.id));
          return next;
        },
        { replace: false },
      ),
    [setParams],
  );
  const openNew = useCallback((defaults = {}) => setDraft({ defaults }), []);
  const close = useCallback(() => {
    setDraft(null);
    if (params.get("task")) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("task");
          return next;
        },
        { replace: true },
      );
    }
  }, [params, setParams]);

  const modal = task ? (
    <TaskModal key={task.id} task={task} onClose={close} />
  ) : draft ? (
    <TaskModal defaults={draft.defaults} onClose={close} />
  ) : null;

  return { modal, openTask, openNew };
}
