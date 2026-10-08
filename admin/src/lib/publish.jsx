import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { api } from "./api";
import { useAuth } from "./auth";

/**
 * Стан публікації сайту: після збереження в адмінці GitHub Actions
 * збирає й викладає сайт (2–3 хв). Тут — останній запуск і його статус.
 */
const PublishContext = createContext(null);

export function PublishProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [waiting, setWaiting] = useState(null); // sha коміту, на деплой якого чекаємо
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api("/content/status"));
    } catch (error) {
      setStatus((prev) => ({ ...(prev || {}), error: error.message }));
    }
  }, []);

  const isAdmin = user?.role === "admin";
  const runs = useMemo(() => status?.deploy?.runs || [], [status]);
  const latest = runs[0] || null;
  const busy = Boolean(waiting) || runs.some((run) => run.status !== "completed");

  useEffect(() => {
    if (!isAdmin) return undefined;
    refresh();
    return undefined;
  }, [isAdmin, refresh]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(refresh, busy ? 5000 : 60000);
    return () => clearTimeout(timer.current);
  }, [isAdmin, busy, status, refresh]);

  // дочекались: запуск для нашого коміту завершився (або з'явився новіший)
  useEffect(() => {
    if (!waiting || !runs.length) return;
    const run = runs.find((r) => r.sha === waiting);
    if (run?.status === "completed") setWaiting(null);
  }, [waiting, runs]);

  // GitHub Actions може не показати запуск (немає доступу Actions) — не чекаємо вічно
  useEffect(() => {
    if (!waiting) return undefined;
    const limit = setTimeout(() => setWaiting(null), 10 * 60 * 1000);
    return () => clearTimeout(limit);
  }, [waiting]);

  const published = useCallback(
    (commit) => {
      if (commit?.sha && !commit.unchanged) setWaiting(commit.sha);
      setTimeout(refresh, 2500);
    },
    [refresh],
  );

  const run = waiting ? runs.find((r) => r.sha === waiting) : latest;

  return <PublishContext.Provider value={{ status, run, waiting, busy, refresh, published }}>{children}</PublishContext.Provider>;
}

export const usePublish = () => useContext(PublishContext);
