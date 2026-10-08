/**
 * Робота з репозиторієм сайту через GitHub API (без git на сервері).
 *
 * Читання: дерево файлів гілки + вміст файлів (кеш за sha — вміст з тим самим
 * sha ніколи не змінюється). Запис: один атомарний коміт на одне збереження
 * (blobs → tree → commit → оновлення гілки). Пуш запускає GitHub Actions,
 * який збирає й викладає сайт — так само, як після звичайного git push.
 *
 * Токен (fine-grained, лише репозиторій сайту): Contents — Read and write,
 * Actions — Read-only. Зберігається тільки в .env на сервері.
 */
import { GITHUB_API, GITHUB_BRANCH, GITHUB_REPO, GITHUB_TOKEN } from "./config.mjs";
import { HttpError } from "./http.mjs";

export const githubConfigured = () => Boolean(GITHUB_TOKEN && GITHUB_REPO);

async function gh(method, pathname, body) {
  if (!githubConfigured()) throw new HttpError(503, "Публикация не настроена: нет GITHUB_TOKEN / GITHUB_REPO в .env сервера");
  const response = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pikaleads-admin",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 200) };
  }
  if (!response.ok) {
    const error = new HttpError(
      response.status === 401 || response.status === 403 ? 502 : response.status,
      `GitHub: ${data?.message || response.statusText}`,
    );
    error.github = response.status;
    throw error;
  }
  return data;
}

// ---------- читання ----------

const HEAD_TTL = 15_000;
let head = { sha: null, at: 0, tree: null, treeSha: null };

/** Поточний коміт гілки та дерево файлів { path → {sha, size} } */
export async function snapshot({ force = false } = {}) {
  if (!force && head.tree && Date.now() - head.at < HEAD_TTL) return head;

  const ref = await gh("GET", `/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}`);
  const sha = ref.object.sha;
  if (sha !== head.sha || !head.tree) {
    const commit = await gh("GET", `/git/commits/${sha}`);
    const tree = await gh("GET", `/git/trees/${commit.tree.sha}?recursive=1`);
    // обрізане дерево = не всі файли видно → перевірка конфліктів ненадійна, краще зупинитись
    if (tree.truncated) throw new HttpError(500, "GitHub вернул неполный список файлов репозитория");
    const files = new Map();
    for (const entry of tree.tree) {
      if (entry.type === "blob") files.set(entry.path, { sha: entry.sha, size: entry.size });
    }
    head = { sha, at: Date.now(), tree: files, treeSha: commit.tree.sha };
  } else {
    head = { ...head, at: Date.now() };
  }
  return head;
}

/** Кеш вмісту за sha (обмежений за розміром, найдавніші — геть) */
const BLOB_CACHE_LIMIT = 80 * 1024 * 1024;
const blobs = new Map();
let blobBytes = 0;

function remember(sha, buffer) {
  blobs.set(sha, buffer);
  blobBytes += buffer.length;
  for (const [key, value] of blobs) {
    if (blobBytes <= BLOB_CACHE_LIMIT) break;
    blobs.delete(key);
    blobBytes -= value.length;
  }
}

const inflight = new Map();

export async function readBlob(sha) {
  if (blobs.has(sha)) {
    const buffer = blobs.get(sha);
    blobs.delete(sha);
    blobs.set(sha, buffer); // свіжий — у кінець черги
    return buffer;
  }
  if (!inflight.has(sha)) {
    inflight.set(
      sha,
      gh("GET", `/git/blobs/${sha}`)
        .then((blob) => {
          const buffer = Buffer.from(blob.content, blob.encoding === "base64" ? "base64" : "utf8");
          remember(sha, buffer);
          return buffer;
        })
        .finally(() => inflight.delete(sha)),
    );
  }
  return inflight.get(sha);
}

/** Паралельно, але не більше limit запитів одночасно */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function readJsonFile(path, files) {
  const entry = files.get(path);
  if (!entry) return null;
  const buffer = await readBlob(entry.sha);
  try {
    return { sha: entry.sha, data: JSON.parse(buffer.toString("utf8")) };
  } catch {
    throw new HttpError(500, `Некорректный JSON в репозитории: ${path}`);
  }
}

// ---------- запис ----------

let queue = Promise.resolve();
/** Коміти — строго по черзі (інакше два збереження посварились би за гілку) */
const serial = (task) => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

/**
 * Атомарний коміт.
 *   changes: [{ path, content: string | Buffer | null (видалити) }]
 *   expect:  { path → sha | null } — файл не мав змінитися з моменту відкриття
 *            (null — файлу не мало бути). Інакше 409, нічого не записується.
 */
export function commitFiles({ changes, expect = {}, message, author }) {
  return serial(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await snapshot({ force: true });

      for (const [path, sha] of Object.entries(expect)) {
        const actual = current.tree.get(path)?.sha ?? null;
        if (actual !== sha) {
          throw new HttpError(
            409,
            sha === null
              ? "Запись с таким адресом уже существует"
              : "Эту запись уже изменили (другой сотрудник или напрямую в репозитории). Обновите страницу — ваши правки сохранятся в черновике",
          );
        }
      }

      const entries = [];
      for (const { path, content } of changes) {
        if (content === null) {
          if (current.tree.has(path)) entries.push({ path, mode: "100644", type: "blob", sha: null });
          continue;
        }
        if (Buffer.isBuffer(content)) {
          const blob = await gh("POST", "/git/blobs", { content: content.toString("base64"), encoding: "base64" });
          entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
        } else {
          entries.push({ path, mode: "100644", type: "blob", content });
        }
      }
      if (!entries.length) return { sha: current.sha, unchanged: true };

      const tree = await gh("POST", "/git/trees", { base_tree: current.treeSha, tree: entries });
      if (tree.sha === current.treeSha) return { sha: current.sha, unchanged: true };

      const commit = await gh("POST", "/git/commits", {
        message,
        tree: tree.sha,
        parents: [current.sha],
        ...(author ? { author: { ...author, date: new Date().toISOString() } } : {}),
      });

      try {
        await gh("PATCH", `/git/refs/heads/${encodeURIComponent(GITHUB_BRANCH)}`, { sha: commit.sha, force: false });
      } catch (error) {
        // гілку щойно хтось оновив (git push) — пробуємо ще раз поверх нового коміту
        if (error.github === 422 && attempt < 2) continue;
        throw error;
      }

      head = { sha: null, at: 0, tree: null, treeSha: null };
      return { sha: commit.sha, url: commit.html_url };
    }
    throw new HttpError(409, "Не удалось сохранить: репозиторий постоянно меняется, попробуйте ещё раз");
  });
}

// ---------- статус деплою ----------

let deployCache = { at: 0, value: null };

/** Останні запуски GitHub Actions (потрібен доступ Actions: Read-only) */
export async function deployStatus() {
  if (Date.now() - deployCache.at < 8_000) return deployCache.value;
  let value;
  try {
    const data = await gh("GET", `/actions/runs?branch=${encodeURIComponent(GITHUB_BRANCH)}&per_page=5`);
    value = {
      available: true,
      runs: (data.workflow_runs || []).map((run) => ({
        id: run.id,
        status: run.status, // queued | in_progress | completed
        conclusion: run.conclusion, // success | failure | cancelled | null
        sha: run.head_sha,
        title: run.display_title,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        url: run.html_url,
      })),
    };
  } catch (error) {
    value = { available: false, error: error.message, runs: [] };
  }
  deployCache = { at: Date.now(), value };
  return value;
}
