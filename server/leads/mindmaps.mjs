/**
 * Майнд-карти (дошки в стилі Miro): вузли різних типів, стрілки між ними, прив'язка до проекту й задач.
 * Клієнт зберігає карту цілком (автозбереження); version захищає від затирання чужих змін.
 */
import { HttpError } from "./http.mjs";
import { projectExists } from "./projects.mjs";
import { createCollection } from "./store.mjs";
import { can } from "./auth.mjs";

export const mindmaps = createCollection("mindmaps.json");

const KINDS = ["card", "sticky", "shape", "text"];
const SHAPES = ["rect", "ellipse", "diamond"];
const DIRS = ["TB", "LR", "RL"];
const COLOR = /^#[0-9a-f]{6}$/i;
const WORLD_W = 4000;
const WORLD_H = 3000;

const now = () => new Date().toISOString();
const num = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function cleanNodes(list) {
  if (!Array.isArray(list)) return [];
  if (list.length > 500) throw new HttpError(400, "Слишком много элементов на карте (максимум 500)");
  const seen = new Set();
  return list
    .map((n) => {
      const id = String(n?.id ?? "").slice(0, 40);
      if (!/^[\w-]{1,40}$/.test(id) || seen.has(id)) return null;
      seen.add(id);
      const kind = KINDS.includes(n.kind) ? n.kind : "card";
      const node = {
        id,
        kind,
        x: num(n.x, 0, WORLD_W - 60, 0),
        y: num(n.y, 0, WORLD_H - 40, 0),
        text: String(n.text ?? "").slice(0, 300),
        color: COLOR.test(n.color) ? n.color : "#6fa8ff",
      };
      if (kind === "shape") node.shape = SHAPES.includes(n.shape) ? n.shape : "rect";
      if (n.w) node.w = num(n.w, 90, 800, undefined);
      if (n.h) node.h = num(n.h, 36, 600, undefined);
      if (n.taskId) node.taskId = num(n.taskId, 1, 1e9, undefined);
      return node;
    })
    .filter(Boolean);
}

function cleanEdges(list, nodes) {
  if (!Array.isArray(list)) return [];
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set();
  return list
    .slice(0, 1500)
    .map((e) => ({ from: String(e?.from ?? ""), to: String(e?.to ?? "") }))
    .filter((e) => {
      const key = `${e.from}>${e.to}`;
      if (e.from === e.to || !ids.has(e.from) || !ids.has(e.to) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export const publicMap = (m) => ({
  id: m.id,
  name: m.name,
  projectId: m.projectId && projectExists(m.projectId) ? m.projectId : null,
  dir: m.dir || "TB",
  nodes: m.nodes || [],
  edges: m.edges || [],
  version: m.version || 1,
  createdBy: m.createdBy || null,
  updatedBy: m.updatedBy || null,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt || m.createdAt,
});

export const activeMaps = () => mindmaps.filter((m) => !m.deleted).map(publicMap);

function getMap(id) {
  const m = mindmaps.get(id);
  if (!m || m.deleted) throw new HttpError(404, "Карта не найдена");
  return m;
}

function validProject(value) {
  if (!value) return null;
  if (!projectExists(Number(value))) throw new HttpError(400, "Проект не найден");
  return Number(value);
}

export function createMap(body, user) {
  const name = String(body.name ?? "").trim().slice(0, 120) || "Новая карта";
  const nodes = cleanNodes(body.nodes);
  const m = mindmaps.insert({
    name,
    projectId: validProject(body.projectId),
    dir: DIRS.includes(body.dir) ? body.dir : "TB",
    nodes: nodes.length ? nodes : [{ id: "root", kind: "card", x: 560, y: 60, text: String(body.rootText ?? "").trim().slice(0, 200) || "Центральная идея", color: "#FFC629" }],
    edges: cleanEdges(body.edges, nodes),
    version: 1,
    createdBy: { userId: user.id, name: user.name },
    createdAt: now(),
  });
  return publicMap(m);
}

/** Зберегти карту. Якщо її змінили після того, як клієнт її завантажив, — 409 і свіжа версія */
export function saveMap(id, body, user) {
  const m = getMap(id);
  if (body.version !== undefined && Number(body.version) !== (m.version || 1)) {
    const error = new HttpError(409, `Карту изменил(а) ${m.updatedBy?.name || "другой сотрудник"} — загружена свежая версия`);
    error.map = publicMap(m);
    throw error;
  }
  const patch = {};
  if ("name" in body) patch.name = String(body.name ?? "").trim().slice(0, 120) || "Без названия";
  if ("projectId" in body) patch.projectId = validProject(body.projectId);
  if ("dir" in body && DIRS.includes(body.dir)) patch.dir = body.dir;
  if ("nodes" in body) {
    patch.nodes = cleanNodes(body.nodes);
    patch.edges = cleanEdges(body.edges ?? m.edges, patch.nodes);
  } else if ("edges" in body) {
    patch.edges = cleanEdges(body.edges, m.nodes);
  }
  return publicMap(
    mindmaps.update(m.id, (x) => {
      Object.assign(x, patch);
      x.version = (x.version || 1) + 1;
      x.updatedAt = now();
      x.updatedBy = { userId: user.id, name: user.name };
    }),
  );
}

export function deleteMap(id, user) {
  const m = getMap(id);
  if (!can(user, "manage") && m.createdBy?.userId !== user.id) throw new HttpError(403, "Удалить может автор карты или администратор");
  mindmaps.update(m.id, (x) => {
    x.deleted = true;
    x.updatedAt = now();
  });
}
