import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, upload } from "./api";

/** Проекти: список для дошки задач, Ганта, сторінки «Проекты» і вікна задачі */
const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(
    () =>
      api("/projects")
        .then(({ projects: list }) => {
          setProjects(list);
          setLoaded(true);
        })
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    reload();
    const timer = setInterval(() => document.visibilityState === "visible" && reload(), 120_000);
    return () => clearInterval(timer);
  }, [reload]);

  const replace = useCallback(
    (project) => setProjects((prev) => (prev.some((p) => p.id === project.id) ? prev.map((p) => (p.id === project.id ? project : p)) : [...prev, project])),
    [],
  );

  const call = useCallback(
    async (path, options) => {
      const { project } = await api(path, options);
      replace(project);
      return project;
    },
    [replace],
  );

  const value = useMemo(
    () => ({
      projects,
      loaded,
      reload,
      byId: Object.fromEntries(projects.map((p) => [p.id, p])),
      create: (body) => call("/projects", { method: "POST", body }),
      update: (id, body) => call(`/projects/${id}`, { method: "PATCH", body }),
      remove: async (id) => {
        await api(`/projects/${id}`, { method: "DELETE" });
        setProjects((prev) => prev.filter((p) => p.id !== id));
      },
      addCall: (id, body) => call(`/projects/${id}/calls`, { method: "POST", body }),
      updateCall: (id, callId, body) => call(`/projects/${id}/calls/${callId}`, { method: "PATCH", body }),
      removeCall: (id, callId) => call(`/projects/${id}/calls/${callId}`, { method: "DELETE" }),
      addFile: async (id, file) => {
        const { project } = await upload(`/projects/${id}/files`, file);
        replace(project);
        return project;
      },
      removeFile: async (fileId) => {
        const { project } = await api(`/files/${fileId}`, { method: "DELETE" });
        if (project) replace(project);
      },
    }),
    [projects, loaded, reload, call, replace],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export const useProjects = () => useContext(ProjectsContext);

// ---------- довідники (як у макеті) ----------
export const PROJECT_STATUS = {
  active: { label: "Активен", color: "#5ac878", bg: "rgba(90,200,120,.15)" },
  paused: { label: "На паузе", color: "#f0883e", bg: "rgba(240,136,62,.15)" },
  done: { label: "Завершён", color: "#5b9bff", bg: "rgba(91,155,255,.15)" },
};
export const PROJECT_COLORS = ["#5b9bff", "#4fd88a", "#FFC629", "#f0883e", "#b98bff", "#ff7d7d"];
export const PROJECT_ICONS = ["◈", "🏥", "🎰", "📣", "📱", "💊", "🛒", "🎮", "💰", "📊", "🚀", "🎨", "🏦", "🍔", "🏠", "⚽"];
export const CALL_SERVICES = {
  zoom: { label: "Zoom", color: "#2D8CFF" },
  googlemeet: { label: "Google Meet", color: "#00AC47" },
  loom: { label: "Loom", color: "#625DF5" },
  phone: { label: "Телефон", color: "#4fd88a" },
};

const pad = (n) => String(n).padStart(2, "0");
/** «2026-10-05» → «05.10.2026» */
export const dayDisp = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
