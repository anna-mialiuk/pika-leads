import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "./api";
import { useAuth } from "./auth";

/**
 * Задачі по заявках: один список на всю панель (CRM, картка заявки, сторінка «Задачи», лічильник у меню).
 * Оновлюється раз на хвилину й після кожної дії.
 */
const TasksContext = createContext(null);

export function TasksProvider({ children }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  const reload = useCallback(
    () =>
      api("/tasks")
        .then(({ tasks: list }) => {
          setTasks(list);
          setLoaded(true);
        })
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    reload();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
      setTick(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, [reload]);

  const replace = (task) =>
    setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task]));

  const create = useCallback(async (body) => {
    const { task } = await api("/tasks", { method: "POST", body });
    replace(task);
    return task;
  }, []);

  const update = useCallback(
    async (id, body) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...body } : t)));
      try {
        const { task } = await api(`/tasks/${id}`, { method: "PATCH", body });
        replace(task);
        return task;
      } catch (error) {
        reload();
        throw error;
      }
    },
    [reload],
  );

  const remove = useCallback(async (id) => {
    await api(`/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // лічильник у меню: мої невиконані з терміном до кінця сьогодні
  const myDueCount = useMemo(() => {
    const endOfDay = new Date(tick);
    endOfDay.setHours(23, 59, 59, 999);
    return tasks.filter((t) => !t.done && t.assigneeId === user?.id && new Date(t.dueAt) <= endOfDay).length;
  }, [tasks, user, tick]);

  return <TasksContext.Provider value={{ tasks, loaded, reload, create, update, remove, myDueCount }}>{children}</TasksContext.Provider>;
}

export const useTasks = () => useContext(TasksContext);

// ---------- дати ----------
const pad = (n) => String(n).padStart(2, "0");

/** Date → значення для <input type="datetime-local"> */
export const toLocalInput = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const at = (daysFromToday, hours, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const inMinutes = (minutes) => {
  const d = new Date(Date.now() + minutes * 60_000);
  d.setSeconds(0, 0);
  // округлюємо до 5 хвилин
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
  return d;
};

const nextMonday = () => {
  const d = new Date();
  const days = (8 - d.getDay()) % 7 || 7;
  return at(days, 10);
};

export const DUE_PRESETS = [
  { label: "Через час", get: () => inMinutes(60) },
  { label: "Через 3 часа", get: () => inMinutes(180) },
  { label: "Завтра 10:00", get: () => at(1, 10) },
  { label: "Завтра 15:00", get: () => at(1, 15) },
  { label: "В понедельник", get: nextMonday },
];

export const TITLE_PRESETS = ["Перезвонить", "Отправить КП", "Написать в Telegram", "Встреча / созвон", "Уточнить бюджет"];

const DAY = 864e5;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

/** «Сегодня 15:00», «Завтра 10:00», «пн, 13.10 10:00» */
export function formatDue(iso) {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const diff = Math.round((startOfDay(d) - startOfDay(Date.now())) / DAY);
  if (diff === 0) return `Сегодня ${time}`;
  if (diff === 1) return `Завтра ${time}`;
  if (diff === -1) return `Вчера ${time}`;
  const day = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getDay()];
  return `${day}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${time}`;
}

export const isOverdue = (task) => !task.done && new Date(task.dueAt) < new Date();

/** Групи для сторінки задач */
export function groupTasks(list) {
  const today = startOfDay(Date.now());
  const groups = { overdue: [], today: [], tomorrow: [], later: [], done: [] };
  for (const task of list) {
    if (task.done) {
      if (Date.now() - new Date(task.doneAt || task.dueAt) < 7 * DAY) groups.done.push(task);
      continue;
    }
    const due = new Date(task.dueAt);
    if (due < new Date()) groups.overdue.push(task);
    else if (startOfDay(due) === today) groups.today.push(task);
    else if (startOfDay(due) === today + DAY) groups.tomorrow.push(task);
    else groups.later.push(task);
  }
  const byDue = (a, b) => new Date(a.dueAt) - new Date(b.dueAt);
  Object.values(groups).forEach((g) => g.sort(byDue));
  groups.done.sort((a, b) => new Date(b.doneAt) - new Date(a.doneAt));
  return groups;
}
