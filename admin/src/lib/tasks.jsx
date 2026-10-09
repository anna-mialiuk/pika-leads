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
      const optimistic = "status" in body ? { ...body, done: body.status === "done" || body.status === "rejected" } : body;
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...optimistic } : t)));
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

/** «04.07» для картки */
export const formatShort = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

// ---------- колонки й пріоритети (як у макеті) ----------
export const TASK_COLUMNS = [
  { key: "todo", label: "To Do", color: "#8a8f98" },
  { key: "inprogress", label: "В работе", color: "#FFC629" },
  { key: "review", label: "На проверке", color: "#5b9bff" },
  { key: "consideration", label: "На рассмотрении", color: "#b98bff" },
  { key: "done", label: "Готово", color: "#4fd88a" },
  { key: "rejected", label: "Отклонено", color: "#ff7d7d" },
];
export const COLUMN_BY_KEY = Object.fromEntries(TASK_COLUMNS.map((c) => [c.key, c]));

export const PRIORITIES = [
  { key: "low", label: "Низкий", color: "#5ac878", bg: "rgba(90,200,120,.15)" },
  { key: "medium", label: "Средний", color: "#FFC629", bg: "rgba(255,198,41,.15)" },
  { key: "high", label: "Высокий", color: "#ff7d7d", bg: "rgba(255,90,90,.15)" },
];
export const PRIORITY_BY_KEY = Object.fromEntries(PRIORITIES.map((p) => [p.key, p]));

// ---------- опис задачі: тільки дозволені теги (те саме робить сервер) ----------
const RICH_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "H3", "P", "DIV", "BR", "UL", "OL", "LI", "BLOCKQUOTE", "A", "SPAN"]);
const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "TEMPLATE", "NOSCRIPT", "TEXTAREA", "TITLE"]);

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE || DROP_WITH_CONTENT.has(child.tagName)) {
        child.remove();
        continue;
      }
      walk(child);
      if (!RICH_TAGS.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      const keep = {};
      if (child.tagName === "A") {
        const href = (child.getAttribute("href") || "").trim();
        if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) Object.assign(keep, { href, target: "_blank", rel: "noopener noreferrer" });
      }
      if ((child.tagName === "UL" || child.tagName === "LI") && child.getAttribute("class") === "rte-check") keep.class = "rte-check";
      if (child.tagName === "LI" && child.getAttribute("data-done") === "1") keep["data-done"] = "1";
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      for (const [name, value] of Object.entries(keep)) child.setAttribute(name, value);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

/** Порожній опис редактора («<br>», «<p></p>») → "" */
export const isBlankHtml = (html) => !String(html || "").replace(/<br\s*\/?>|<\/?(p|div)>|&nbsp;|\s/gi, "");
