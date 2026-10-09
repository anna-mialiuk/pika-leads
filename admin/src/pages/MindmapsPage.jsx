import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TasksHeader, useTaskModal } from "../components/TasksShell";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useProjects } from "../lib/projects";
import { useTasks } from "../lib/tasks";

import "./MindmapsPage.css";

const WORLD_W = 4000;
const WORLD_H = 3000;
const SWATCHES = ["#FFC629", "#6fa8ff", "#b98bff", "#4fd88a", "#f0a83e", "#25c8ee", "#ff7d7d"];
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2;

const KINDS = {
  card: { kind: "card", text: "Новый узел", color: "#6fa8ff" },
  sticky: { kind: "sticky", text: "Заметка", color: "#FFC629" },
  shape: { kind: "shape", shape: "rect", text: "Блок", color: "#6fa8ff" },
  ellipse: { kind: "shape", shape: "ellipse", text: "Овал", color: "#4fd88a" },
  diamond: { kind: "shape", shape: "diamond", text: "Решение?", color: "#f0a83e" },
  text: { kind: "text", text: "Текст", color: "#e8e6ea" },
};

const hexA = (hex, a) => {
  const h = (hex || "#6fa8ff").replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

const newId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Розмір вузла (для стрілок, розкладки, мінікарти) */
function dim(n) {
  const kind = n.kind || "card";
  if (kind === "sticky") return { w: n.w || 156, h: n.h || 64 };
  if (kind === "shape") return { w: n.w || 190, h: n.h || ((n.shape || "rect") === "rect" ? 72 : 118) };
  if (kind === "text") return { w: n.w || 176, h: n.h || 36 };
  return { w: n.w || 176, h: n.h || 60 };
}

/** Вигляд вузла — як у макеті */
function look(n) {
  const kind = n.kind || "card";
  const { w, h } = dim(n);
  if (kind === "sticky") {
    return { w, cy: n.h ? h / 2 : 34, bg: hexA(n.color, 0.9), border: `1px solid ${hexA(n.color, 0.6)}`, radius: 12, textColor: "#1a1712", align: "left", weight: 700, size: 13, minH: n.h ? h : 48, justify: "flex-start", pad: "9px 11px 10px" };
  }
  if (kind === "shape") {
    const shp = n.shape || "rect";
    if (shp === "diamond") {
      return { w, cy: h / 2, diamond: true, bg: "transparent", border: "none", radius: 0, textColor: "#1a1712", align: "center", weight: 800, size: 12.5, minH: h, justify: "center", pad: "10px 26px" };
    }
    return { w, cy: h / 2, bg: "var(--card)", border: `2px solid ${n.color}`, radius: shp === "ellipse" ? "50%" : 12, textColor: "var(--text)", align: "center", weight: 800, size: 13.5, minH: h, justify: "center", pad: shp === "ellipse" ? "10px 22px" : "10px 12px" };
  }
  if (kind === "text") {
    return { w, cy: n.h ? h / 2 : 16, bg: "transparent", border: "1px solid transparent", radius: 8, textColor: n.color, align: "left", weight: 800, size: 15.5, minH: n.h || "auto", justify: "center", pad: "6px 8px", flat: true };
  }
  return { w, cy: n.h ? h / 2 : 28, bg: "var(--card)", border: "1.5px solid var(--border2)", top: `4px solid ${n.color}`, radius: 12, textColor: "var(--text)", align: "left", weight: 700, size: 13, minH: n.h || "auto", justify: "flex-start", pad: "9px 11px 10px", card: true };
}

/** Розкласти дерево (TB — зверху вниз, LR / RL — вбік) */
function arrange(map, dir) {
  const byId = Object.fromEntries(map.nodes.map((n) => [n.id, n]));
  const children = Object.fromEntries(map.nodes.map((n) => [n.id, []]));
  const indeg = Object.fromEntries(map.nodes.map((n) => [n.id, 0]));
  map.edges.forEach((e) => {
    if (byId[e.from] && byId[e.to]) {
      children[e.from].push(e.to);
      indeg[e.to]++;
    }
  });
  let roots = map.nodes.filter((n) => !indeg[n.id]).map((n) => n.id);
  if (!roots.length && map.nodes.length) roots = [map.nodes[0].id];
  const horiz = dir !== "TB";
  const gapMain = horiz ? 96 : 78;
  const gapCross = 30;
  const visited = {};
  const pos = {};
  let cursor = 0;
  const walk = (id, depth) => {
    if (visited[id]) return pos[id].c;
    visited[id] = true;
    const kids = children[id].filter((k) => !visited[k]);
    const d = dim(byId[id]);
    if (!kids.length) {
      const size = horiz ? d.h : d.w;
      const c = cursor + size / 2;
      cursor += size + gapCross;
      pos[id] = { depth, c };
      return c;
    }
    const cs = kids.map((k) => walk(k, depth + 1));
    const c = (cs[0] + cs[cs.length - 1]) / 2;
    pos[id] = { depth, c };
    return c;
  };
  roots.forEach((r) => {
    walk(r, 0);
    cursor += 46;
  });
  map.nodes.forEach((n) => {
    if (visited[n.id]) return;
    const d = dim(n);
    const size = horiz ? d.h : d.w;
    pos[n.id] = { depth: 0, c: cursor + size / 2 };
    cursor += size + gapCross;
  });
  const depths = {};
  map.nodes.forEach((n) => {
    const d = dim(n);
    depths[pos[n.id].depth] = Math.max(depths[pos[n.id].depth] || 0, horiz ? d.w : d.h);
  });
  const maxDepth = Math.max(0, ...Object.keys(depths).map(Number));
  const center = {};
  let acc = 60;
  for (let d = 0; d <= maxDepth; d++) {
    center[d] = acc + (depths[d] || 60) / 2;
    acc += (depths[d] || 60) + gapMain;
  }
  return map.nodes.map((n) => {
    const p = pos[n.id];
    const d = dim(n);
    let mc = center[p.depth];
    if (dir === "RL") mc = acc - mc;
    const cc = 60 + p.c;
    const x = horiz ? mc - d.w / 2 : cc - d.w / 2;
    const y = horiz ? cc - d.h / 2 : mc - d.h / 2;
    return { ...n, x: clamp(Math.round(x), 0, WORLD_W - 60), y: clamp(Math.round(y), 0, WORLD_H - 40) };
  });
}

/** Шлях стрілки між вузлами (кубічна крива, як у макеті) */
function edgePath(a, b, la, lb, dir) {
  const ca = { x: a.x + la.w / 2, y: a.y + la.cy };
  const cb = { x: b.x + lb.w / 2, y: b.y + lb.cy };
  let sx;
  let sy;
  let ex;
  let ey;
  let c1x;
  let c1y;
  let c2x;
  let c2y;
  if (dir === "TB") {
    const down = cb.y >= ca.y;
    sy = ca.y + (down ? la.cy : -la.cy);
    ey = cb.y + (down ? -lb.cy - 11 : lb.cy + 11);
    sx = ca.x;
    ex = cb.x;
    const k = Math.max(28, Math.abs(ey - sy) * 0.5);
    c1x = sx;
    c1y = sy + (down ? k : -k);
    c2x = ex;
    c2y = ey + (down ? -k : k);
  } else {
    const rl = dir === "RL";
    const right = rl ? cb.x <= ca.x : cb.x >= ca.x;
    sx = ca.x + (right ? la.w / 2 : -la.w / 2);
    ex = cb.x + (right ? -lb.w / 2 - 11 : lb.w / 2 + 11);
    sy = ca.y;
    ey = cb.y;
    const k = Math.max(30, Math.abs(ex - sx) * 0.5);
    c1x = sx + (right ? k : -k);
    c1y = sy;
    c2x = ex + (right ? -k : k);
    c2y = ey;
  }
  return `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`;
}

/* ================= сторінка ================= */

function MindmapsPage() {
  const { user } = useAuth();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const { modal: taskModal, openTask } = useTaskModal();

  const [maps, setMaps] = useState(null);
  const [, setActiveId] = useState(null);
  const [map, setMap] = useState(null); // робоча копія активної карти
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState("saved"); // saved | saving | error
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [tool, setTool] = useState("select");
  const [selectId, setSelectId] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [link, setLink] = useState(null); // лінія, що тягнеться від ручки
  const [lastKind, setLastKind] = useState("card");
  const [hist, setHist] = useState({ past: [], future: [] });

  const viewportRef = useRef(null);
  const mapRef = useRef(map);
  const viewRef = useRef(view);
  const dirtyRef = useRef(false);
  mapRef.current = map;
  viewRef.current = view;
  dirtyRef.current = dirty;

  // ---------- завантаження та автозбереження ----------
  const load = useCallback(
    () =>
      api("/mindmaps")
        .then(({ maps: list }) => {
          setMaps(list);
          return list;
        })
        .catch((e) => setError(e.message)),
    [],
  );

  useEffect(() => {
    load().then((list) => {
      if (list?.length) {
        setActiveId(list[0].id);
        setMap(list[0]);
      }
    });
  }, [load]);

  // чужі зміни: якщо в нас нічого не змінено — підтягуємо свіжу версію
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      load().then((list) => {
        const fresh = list?.find((m) => m.id === mapRef.current?.id);
        if (fresh && !dirtyRef.current && fresh.version !== mapRef.current.version) setMap(fresh);
      });
    }, 15_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!dirty || !map || saveState === "saving") return undefined;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      const body = { version: map.version, name: map.name, projectId: map.projectId, dir: map.dir, nodes: map.nodes, edges: map.edges };
      try {
        const { map: saved } = await api(`/mindmaps/${map.id}`, { method: "PUT", body });
        // поки зберігали, могли щось змінити — беремо лише нову версію
        setMap((cur) => (cur && cur.id === saved.id ? { ...cur, version: saved.version, updatedAt: saved.updatedAt } : cur));
        setMaps((list) => list.map((m) => (m.id === saved.id ? saved : m)));
        setDirty((d) => (mapRef.current === map ? false : d));
        setSaveState("saved");
      } catch (e) {
        if (e.status === 409 && e.data?.map) {
          setMap(e.data.map);
          setMaps((list) => list.map((m) => (m.id === e.data.map.id ? e.data.map : m)));
          setDirty(false);
          setNotice(e.message);
          setSaveState("saved");
        } else {
          setSaveState("error");
          setError(e.message);
        }
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty, map, saveState]);

  // ---------- зміни карти ----------
  const snapshot = (m) => JSON.stringify({ nodes: m.nodes, edges: m.edges });
  const pushHist = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    setHist((h) => ({ past: [...h.past, snapshot(m)].slice(-60), future: [] }));
  }, []);

  const change = useCallback((fn, { history = true } = {}) => {
    if (history) pushHist();
    setMap((m) => (m ? { ...m, ...fn(m) } : m));
    setDirty(true);
  }, [pushHist]);

  const updNode = useCallback((id, patch) => {
    setMap((m) => (m ? { ...m, nodes: m.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) } : m));
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.past.length || !mapRef.current) return h;
      const prev = JSON.parse(h.past[h.past.length - 1]);
      const cur = snapshot(mapRef.current);
      setMap((m) => ({ ...m, ...prev }));
      setDirty(true);
      setSelectId(null);
      return { past: h.past.slice(0, -1), future: [cur, ...h.future].slice(0, 60) };
    });
  }, []);

  const redo = useCallback(() => {
    setHist((h) => {
      if (!h.future.length || !mapRef.current) return h;
      const next = JSON.parse(h.future[0]);
      const cur = snapshot(mapRef.current);
      setMap((m) => ({ ...m, ...next }));
      setDirty(true);
      setSelectId(null);
      return { past: [...h.past, cur].slice(-60), future: h.future.slice(1) };
    });
  }, []);

  const toWorld = (clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom };
  };

  const addAt = (kindKey, wx, wy) => {
    const id = newId();
    const base = KINDS[kindKey];
    change((m) => ({
      nodes: [...m.nodes, { id, ...base, x: clamp(Math.round(wx - 78), 0, WORLD_W - 60), y: clamp(Math.round(wy - 26), 0, WORLD_H - 40) }],
    }));
    setSelectId(id);
    setLastKind(kindKey);
  };

  const addKind = (kindKey) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    const cx = ((rect ? rect.width / 2 : 300) - v.x) / v.zoom + Math.round(Math.random() * 60 - 30);
    const cy = ((rect ? rect.height / 2 : 220) - v.y) / v.zoom + Math.round(Math.random() * 60 - 30);
    addAt(kindKey, cx, cy);
  };

  const removeNode = (id) => {
    change((m) => ({ nodes: m.nodes.filter((n) => n.id !== id), edges: m.edges.filter((e) => e.from !== id && e.to !== id) }));
    setSelectId(null);
    setConnectFrom(null);
  };

  const duplicate = (id) => {
    const src = mapRef.current?.nodes.find((n) => n.id === id);
    if (!src) return;
    const nid = newId();
    change((m) => ({ nodes: [...m.nodes, { ...src, id: nid, x: clamp(src.x + 30, 0, WORLD_W - 60), y: clamp(src.y + 30, 0, WORLD_H - 40) }] }));
    setSelectId(nid);
  };

  const connect = (from, to) => {
    if (!from || !to || from === to) return;
    change((m) =>
      m.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)) ? {} : { edges: [...m.edges, { from, to }] },
    );
  };

  // ---------- миша / тач ----------
  const nodeDown = (e, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (tool === "hand") return; // панорамує полотно
    e.stopPropagation();
    if (connectFrom && connectFrom !== id) {
      connect(connectFrom, id);
      setConnectFrom(null);
      setSelectId(id);
      return;
    }
    setSelectId(id);
    const tag = e.target.tagName;
    if (tag === "SELECT" || tag === "BUTTON") return;
    // з поля тексту теж можна тягнути: якщо мишу зрушили — це перетягування, а не виділення тексту
    if (tag !== "INPUT") e.preventDefault();
    const node = mapRef.current.nodes.find((n) => n.id === id);
    const start = { x: e.clientX, y: e.clientY, nx: node.x, ny: node.y };
    let moved = false;
    const move = (ev) => {
      const z = viewRef.current.zoom;
      const dx = (ev.clientX - start.x) / z;
      const dy = (ev.clientY - start.y) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) {
        moved = true;
        pushHist();
        if (document.activeElement?.tagName === "INPUT") document.activeElement.blur();
        window.getSelection()?.removeAllRanges();
      }
      ev.preventDefault();
      updNode(id, { x: clamp(Math.round(start.nx + dx), 0, WORLD_W - 60), y: clamp(Math.round(start.ny + dy), 0, WORLD_H - 40) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleDown = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (ev) => {
      const w = toWorld(ev.clientX, ev.clientY);
      setLink({ from: id, x: w.x, y: w.y });
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLink(null);
      const host = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-mmnode]");
      const to = host?.getAttribute("data-mmnode");
      if (to && to !== id) connect(id, to);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const resizeDown = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    const node = mapRef.current.nodes.find((n) => n.id === id);
    const d = dim(node);
    const start = { x: e.clientX, y: e.clientY };
    pushHist();
    const isShape = node.kind === "shape" || node.kind === "sticky";
    const move = (ev) => {
      const z = viewRef.current.zoom;
      const patch = { w: clamp(Math.round(d.w + (ev.clientX - start.x) / z), 90, 800) };
      if (isShape) patch.h = clamp(Math.round(d.h + (ev.clientY - start.y) / z), 36, 600);
      updNode(id, patch);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const canvasDown = (e) => {
    if (connectFrom) {
      setConnectFrom(null);
      return;
    }
    const onBackground = e.target === e.currentTarget || e.target.classList?.contains("mm-world");
    if (!onBackground && tool !== "hand") return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
    let moved = false;
    const move = (ev) => {
      moved = true;
      setView((v) => ({ ...v, x: start.vx + (ev.clientX - start.x), y: start.vy + (ev.clientY - start.y) }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) setSelectId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const zoomAt = useCallback((factor, cx, cy) => {
    setView((v) => {
      const zoom = clamp(+(v.zoom * factor).toFixed(2), ZOOM_MIN, ZOOM_MAX);
      const k = zoom / v.zoom;
      return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);

  // Ctrl/⌘ + коліщатко — масштаб до курсора (нативний слухач, щоб можна було скасувати прокрутку)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, map?.id]);

  const fit = useCallback(() => {
    const m = mapRef.current;
    const el = viewportRef.current;
    if (!m || !el) return;
    if (!m.nodes.length) return setView({ zoom: 1, x: 0, y: 0 });
    const xs = m.nodes.map((n) => n.x);
    const ys = m.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    const maxX = Math.max(...m.nodes.map((n) => n.x + dim(n).w)) + 40;
    const maxY = Math.max(...m.nodes.map((n) => n.y + dim(n).h)) + 80;
    const zoom = clamp(Math.min(1.4, (el.clientWidth - 40) / (maxX - minX), (el.clientHeight - 40) / (maxY - minY)), 0.4, 1.4);
    const z = +zoom.toFixed(2);
    return setView({ zoom: z, x: -minX * z + (el.clientWidth - (maxX - minX) * z) / 2, y: -minY * z + 20 });
  }, []);

  // нова активна карта — показуємо її повністю
  useEffect(() => {
    if (map?.id) requestAnimationFrame(fit);
  }, [map?.id, fit]);

  // клавіатура: Del, Ctrl+D, Ctrl+Z, Ctrl+Shift+Z
  useEffect(() => {
    const onKey = (e) => {
      if (!mapRef.current) return;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if (document.querySelector(".modal")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d" && selectId) {
        e.preventDefault();
        duplicate(selectId);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectId && !typing) {
        e.preventDefault();
        removeNode(selectId);
      } else if (e.key === "Escape") {
        setConnectFrom(null);
        setSelectId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- карти ----------
  const selectMap = (m) => {
    if (m.id === map?.id) return;
    setActiveId(m.id);
    setMap(m);
    setDirty(false);
    setSelectId(null);
    setConnectFrom(null);
    setHist({ past: [], future: [] });
  };

  const addMap = async () => {
    setError("");
    try {
      const { map: created } = await api("/mindmaps", { method: "POST", body: { name: "Новая карта" } });
      setMaps((list) => [...list, created]);
      selectMap(created);
      setSelectId(created.nodes[0]?.id || null);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeMap = async (m) => {
    if (!window.confirm(`Удалить карту «${m.name}»?`)) return;
    try {
      await api(`/mindmaps/${m.id}`, { method: "DELETE" });
      const rest = maps.filter((x) => x.id !== m.id);
      setMaps(rest);
      if (m.id === map?.id) {
        setActiveId(rest[0]?.id || null);
        setMap(rest[0] || null);
        setDirty(false);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  // ---------- рендер ----------
  const looks = useMemo(() => Object.fromEntries((map?.nodes || []).map((n) => [n.id, look(n)])), [map?.nodes]);
  const byId = useMemo(() => Object.fromEntries((map?.nodes || []).map((n) => [n.id, n])), [map?.nodes]);
  const taskChoices = useMemo(
    () => tasks.filter((t) => !map?.projectId || t.projectId === map.projectId || !t.projectId).slice(0, 300),
    [tasks, map?.projectId],
  );

  const mini = useMemo(() => {
    if (!map?.nodes.length) return null;
    const minX = Math.min(...map.nodes.map((n) => n.x)) - 40;
    const minY = Math.min(...map.nodes.map((n) => n.y)) - 40;
    const maxX = Math.max(...map.nodes.map((n) => n.x + dim(n).w)) + 40;
    const maxY = Math.max(...map.nodes.map((n) => n.y + dim(n).h)) + 40;
    const sc = Math.min(140 / Math.max(1, maxX - minX), 92 / Math.max(1, maxY - minY));
    return map.nodes.map((n) => ({ id: n.id, left: (n.x - minX) * sc, top: (n.y - minY) * sc, w: Math.max(4, dim(n).w * sc), bg: n.color }));
  }, [map?.nodes]);

  const dirBtn = (d, label, title) => (
    <button type="button" title={title} className={`mm-icon ${map?.dir === d ? "is-on" : ""}`} onClick={() => change(() => ({ dir: d }), { history: false })}>
      {label}
    </button>
  );

  const saveLabel = saveState === "saving" || dirty ? "Сохраняем…" : saveState === "error" ? "⚠ Не сохранено" : "✓ Сохранено";

  return (
    <div className="tboard-page">
      <TasksHeader />

      <div className="mm-maps">
        <div className="mm-maps__list">
          {(maps || []).map((m) => {
            const active = m.id === map?.id;
            return (
              <div
                key={m.id}
                className={`mm-tab ${active ? "is-active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => selectMap(active ? map : m)}
                onKeyDown={(e) => e.key === "Enter" && selectMap(m)}
              >
                <span>{active ? map.name : m.name}</span>
                <span className="mm-tab__count">{active ? map.nodes.length : m.nodes.length}</span>
                {(user.role === "admin" || m.createdBy?.userId === user.id) && (
                  <button
                    type="button"
                    className="mm-tab__del"
                    title="Удалить карту"
                    aria-label="Удалить карту"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMap(m);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" className="mm-tab mm-tab--add" onClick={addMap}>
            + Карта
          </button>
        </div>
        {map && <span className={`mm-save ${saveState === "error" ? "is-error" : ""}`}>{saveLabel}</span>}
      </div>

      {error && <div className="alert">⚠ {error}</div>}
      {notice && (
        <div className="alert alert--ok" role="status">
          ↻ {notice}
        </div>
      )}

      {maps && !map && (
        <div className="pd-empty pd-empty--page">
          Майнд-карт пока нет.{" "}
          <button type="button" className="pd-link" onClick={addMap}>
            + Создать первую карту
          </button>
        </div>
      )}

      {map && (
        <>
          <div className="mm-meta">
            <label>
              <span>Название карты</span>
              <input value={map.name} maxLength={120} onChange={(e) => change(() => ({ name: e.target.value }), { history: false })} />
            </label>
            <label>
              <span>Привязка к проекту</span>
              <select
                value={map.projectId ?? ""}
                onChange={(e) => change(() => ({ projectId: e.target.value ? Number(e.target.value) : null }), { history: false })}
              >
                <option value="">— без проекта —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mm-toolbar">
            <div className="mm-group">
              <button type="button" className="mm-tool mm-tool--card" onClick={() => addKind("card")}>
                <i />
                Карточка
              </button>
              <button type="button" className="mm-tool mm-tool--sticky" onClick={() => addKind("sticky")}>
                <i />
                Стикер
              </button>
              <button type="button" className="mm-tool mm-tool--rect" onClick={() => addKind("shape")}>
                <i />
                Блок
              </button>
              <button type="button" className="mm-tool mm-tool--ellipse" onClick={() => addKind("ellipse")}>
                <i />
                Овал
              </button>
              <button type="button" className="mm-tool mm-tool--diamond" onClick={() => addKind("diamond")}>
                <i />
                Ромб
              </button>
              <button type="button" className="mm-tool mm-tool--text" onClick={() => addKind("text")}>
                <i>T</i>
                Текст
              </button>
            </div>
            <div className="mm-group">
              <button type="button" className="mm-icon" title="Отменить (Ctrl+Z)" disabled={!hist.past.length} onClick={undo}>
                ↶
              </button>
              <button type="button" className="mm-icon" title="Повторить (Ctrl+Shift+Z)" disabled={!hist.future.length} onClick={redo}>
                ↷
              </button>
            </div>
            <div className="mm-group">
              {dirBtn("TB", "↓", "Сверху вниз")}
              {dirBtn("LR", "→", "Слева направо")}
              {dirBtn("RL", "←", "Справа налево")}
              <span className="mm-sep" />
              <button
                type="button"
                className="mm-text-btn"
                title="Разложить дерево"
                onClick={() => {
                  change((m) => ({ nodes: arrange(m, m.dir || "TB") }));
                  requestAnimationFrame(fit);
                }}
              >
                ⤢ Разложить
              </button>
            </div>
            <button type="button" className={`mm-hand ${tool === "hand" ? "is-on" : ""}`} onClick={() => setTool(tool === "hand" ? "select" : "hand")}>
              ✋ Рука
            </button>
            <div className="mm-group mm-zoom">
              <button type="button" className="mm-icon" title="Отдалить" onClick={() => zoomAt(0.9, viewportRef.current.clientWidth / 2, viewportRef.current.clientHeight / 2)}>
                −
              </button>
              <button type="button" className="mm-zoom__pct" title="Сбросить масштаб" onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
                {Math.round(view.zoom * 100)}%
              </button>
              <button type="button" className="mm-icon" title="Приблизить" onClick={() => zoomAt(1.1, viewportRef.current.clientWidth / 2, viewportRef.current.clientHeight / 2)}>
                +
              </button>
              <span className="mm-sep" />
              <button type="button" className="mm-text-btn" title="Показать всё" onClick={fit}>
                Вписать
              </button>
            </div>
          </div>

          <div className="mm-hint">
            Двойной клик по холсту — новый элемент · тяните узлы мышью · пустой холст/«Рука» — панорама · синяя точка справа у выбранного узла — тяните к
            другому, чтобы соединить · клик по линии удаляет связь · Del — удалить, Ctrl+D — дублировать, Ctrl+колёсико — масштаб.
          </div>

          <div
            ref={viewportRef}
            className={`mm-viewport ${tool === "hand" ? "is-hand" : ""} ${connectFrom ? "is-connecting" : ""}`}
            onPointerDown={canvasDown}
          >
            <div
              className="mm-world"
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
              onDoubleClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const w = toWorld(e.clientX, e.clientY);
                addAt(lastKind, w.x, w.y);
              }}
            >
              <svg className="mm-edges" width={WORLD_W} height={WORLD_H}>
                <defs>
                  <marker id="mmArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L8,3 L0,6 Z" fill="#b98bff" />
                  </marker>
                </defs>
                {map.edges.map((e) => {
                  const a = byId[e.from];
                  const b = byId[e.to];
                  if (!a || !b) return null;
                  const d = edgePath(a, b, looks[e.from], looks[e.to], map.dir || "TB");
                  return (
                    <g key={`${e.from}>${e.to}`}>
                      <path
                        d={d}
                        className="mm-edge-hit"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={() => change((m) => ({ edges: m.edges.filter((x) => !(x.from === e.from && x.to === e.to)) }))}
                      >
                        <title>Удалить связь</title>
                      </path>
                      <path d={d} className="mm-edge" markerEnd="url(#mmArrow)" />
                    </g>
                  );
                })}
                {link && byId[link.from] && (
                  <line
                    x1={byId[link.from].x + looks[link.from].w / 2}
                    y1={byId[link.from].y + looks[link.from].cy}
                    x2={link.x}
                    y2={link.y}
                    className="mm-link"
                  />
                )}
              </svg>

              {map.nodes.map((n) => {
                const l = looks[n.id];
                const selected = selectId === n.id;
                const isFrom = connectFrom === n.id;
                const ring = isFrom ? "#FFC629" : n.color || "#b98bff";
                const task = n.taskId ? tasks.find((t) => t.id === n.taskId) : null;
                const border = l.diamond ? "none" : selected || isFrom ? `2px solid ${ring}` : l.border;
                return (
                  <div
                    key={n.id}
                    data-mmnode={n.id}
                    className="mm-node"
                    style={{ left: n.x, top: n.y, width: l.w, zIndex: selected ? 6 : 3 }}
                    onPointerDown={(e) => nodeDown(e, n.id)}
                  >
                    <div
                      className="mm-node__body"
                      style={{
                        background: l.bg,
                        border,
                        borderTop: l.card ? (selected || isFrom ? `2px solid ${ring}` : l.top) : border,
                        borderRadius: l.radius,
                        padding: l.pad,
                        minHeight: l.minH,
                        justifyContent: l.justify,
                        boxShadow: l.flat || l.diamond ? "none" : selected ? "0 8px 26px rgba(0,0,0,.30)" : "0 3px 12px rgba(0,0,0,.16)",
                      }}
                    >
                      {l.diamond && (
                        <div
                          className="mm-node__diamond"
                          style={{ background: hexA(n.color, 0.88), filter: selected || isFrom ? `drop-shadow(0 0 2px ${ring})` : "none" }}
                        />
                      )}
                      <input
                        value={n.text}
                        maxLength={300}
                        aria-label="Текст элемента"
                        onFocus={() => pushHist()}
                        onChange={(e) => updNode(n.id, { text: e.target.value })}
                        style={{ color: l.textColor, fontSize: l.size, fontWeight: l.weight, textAlign: l.align }}
                      />
                      {task && (
                        <button type="button" className="mm-node__task" onPointerDown={(e) => e.stopPropagation()} onClick={() => openTask(task)}>
                          🔗 {task.title}
                        </button>
                      )}
                    </div>
                    {selected && (
                      <>
                        <div
                          className="mm-node__handle"
                          title="Тяните, чтобы соединить"
                          style={{ top: l.cy - 8 }}
                          onPointerDown={(e) => handleDown(e, n.id)}
                        />
                        <div className="mm-node__resize" title="Изменить размер" onPointerDown={(e) => resizeDown(e, n.id)} />
                        <div className="mm-panel" onPointerDown={(e) => e.stopPropagation()}>
                          <div className="mm-panel__swatches">
                            {SWATCHES.map((col) => (
                              <button
                                key={col}
                                type="button"
                                aria-label={`Цвет ${col}`}
                                style={{ background: col, boxShadow: col === n.color ? `0 0 0 2px var(--card), 0 0 0 4px ${col}` : "none" }}
                                onClick={() => change((m) => ({ nodes: m.nodes.map((x) => (x.id === n.id ? { ...x, color: col } : x)) }))}
                              />
                            ))}
                          </div>
                          <select
                            value={n.taskId || ""}
                            onChange={(e) =>
                              change((m) => ({
                                nodes: m.nodes.map((x) => (x.id === n.id ? { ...x, taskId: e.target.value ? Number(e.target.value) : undefined } : x)),
                              }))
                            }
                          >
                            <option value="">— привязать задачу —</option>
                            {taskChoices.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title.length > 40 ? `${t.title.slice(0, 40)}…` : t.title}
                              </option>
                            ))}
                          </select>
                          <div className="mm-panel__row">
                            <button
                              type="button"
                              className={`mm-panel__connect ${isFrom ? "is-on" : ""}`}
                              onClick={() => setConnectFrom(isFrom ? null : n.id)}
                            >
                              {isFrom ? "Отмена связи" : "Стрелкой"}
                            </button>
                            <button type="button" className="mm-panel__dup" title="Дублировать (Ctrl+D)" onClick={() => duplicate(n.id)}>
                              ⧉
                            </button>
                            <button type="button" className="mm-panel__del" title="Удалить (Del)" onClick={() => removeNode(n.id)}>
                              ✕
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {connectFrom && <div className="mm-connect-hint">Кликните по узлу, с которым соединить · Esc — отмена</div>}

            {mini && (
              <div className="mm-mini" aria-hidden="true">
                <div>
                  {mini.map((d) => (
                    <i key={d.id} style={{ left: d.left, top: d.top, width: d.w, background: d.bg }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {taskModal}
    </div>
  );
}

export default MindmapsPage;
