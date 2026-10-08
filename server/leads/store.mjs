/**
 * Просте сховище у JSON-файлах (без бази даних і залежностей).
 * Дані тримаються в пам'яті, кожна зміна атомарно пишеться на диск
 * (тимчасовий файл → rename), тож файл ніколи не буває «напівзаписаним».
 */
import fs from "node:fs";
import path from "node:path";

import { DATA_DIR } from "./config.mjs";

fs.mkdirSync(DATA_DIR, { recursive: true });

export function readJson(name, fallback) {
  const file = path.join(DATA_DIR, name);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    // пошкоджений файл НЕ підміняємо порожнім (інакше дані перезапишуться) —
    // сервіс зупиняється з помилкою, файл лишається для відновлення
    throw new Error(`[store] ${file} пошкоджено (${error.message}). Відновіть файл з резервної копії.`);
  }
}

export function writeJson(name, value) {
  const file = path.join(DATA_DIR, name);
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 1), { mode: 0o600 });
  fs.renameSync(temp, file);
}

export const dataPath = (name) => path.join(DATA_DIR, name);

/** «Відбиток» файлу: inode + розмір + час (атомарний rename щоразу дає новий inode) */
const signature = (name) => {
  try {
    const stat = fs.statSync(path.join(DATA_DIR, name));
    return `${stat.ino}:${stat.size}:${stat.mtimeMs}`;
  } catch {
    return "";
  }
};

/**
 * Колекція записів з числовим id.
 * Якщо файл змінили ззовні (наприклад, cli.mjs), колекція перечитає його
 * при наступному зверненні — перезапуск сервісу не потрібен.
 */
export function createCollection(name) {
  const existed = fs.existsSync(path.join(DATA_DIR, name));
  let state = readJson(name, { nextId: 1, items: [] });
  let known = signature(name);

  const fresh = () => {
    const current = signature(name);
    if (current && current !== known) {
      try {
        state = readJson(name, state);
        known = current;
      } catch (error) {
        console.error(error.message);
      }
    }
    return state;
  };

  const save = () => {
    writeJson(name, state);
    known = signature(name);
  };

  return {
    all: () => fresh().items,
    get: (id) => fresh().items.find((item) => item.id === Number(id)),
    find: (predicate) => fresh().items.find(predicate),
    filter: (predicate) => fresh().items.filter(predicate),
    insert(item) {
      fresh();
      const record = { ...item, id: state.nextId++ };
      state.items.push(record);
      save();
      return record;
    },
    /** Кілька записів одним збереженням (міграція) */
    insertMany(items) {
      fresh();
      for (const item of items) state.items.push({ ...item, id: state.nextId++ });
      save();
    },
    /** Чи існував файл на момент старту (міграцію робимо лише для нового сховища) */
    existed,
    /** Змінює запис функцією-мутатором і зберігає */
    update(id, mutate) {
      const record = fresh().items.find((item) => item.id === Number(id));
      if (!record) return null;
      mutate(record);
      save();
      return record;
    },
    save,
    get size() {
      return fresh().items.length;
    },
  };
}
