/**
 * Запити до бекенда адмінки (/api/admin/*).
 * Сесія — у httpOnly-cookie; заголовок X-Requested-With обов'язковий (захист від CSRF).
 */
export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.data = data; // тіло відповіді (напр. свіжа версія при конфлікті 409)
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

export async function api(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`/api/admin${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "pika-admin",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте интернет");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) onUnauthorized();
    throw new ApiError(response.status, data.error || "Ошибка запроса", data);
  }
  return data;
}

/** Завантаження файлу (тіло — сам файл, ім'я — у заголовку) */
export async function upload(path, file) {
  if (file.size > 25 * 1024 * 1024) throw new ApiError(413, `«${file.name}» больше 25 МБ`);
  let response;
  try {
    response = await fetch(`/api/admin${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "pika-admin",
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте интернет");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    throw new ApiError(response.status, data.error || "Не удалось загрузить файл");
  }
  return data;
}

export const fileUrl = (id) => `/api/admin/files/${id}`;

export const formatSize = (size) =>
  size < 1024 ? `${size} B` : size < 1048576 ? `${Math.round(size / 1024)} KB` : `${(size / 1048576).toFixed(1)} MB`;

export const fileIcon = (name) => {
  const ext = String(name).split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"].includes(ext)) return "🖼";
  if (["xls", "xlsx", "csv", "numbers"].includes(ext)) return "📊";
  if (["doc", "docx", "txt", "rtf", "pages", "md"].includes(ext)) return "📝";
  if (["pdf"].includes(ext)) return "📕";
  if (["ppt", "pptx", "key"].includes(ext)) return "📽";
  if (["mp4", "mov", "webm", "avi"].includes(ext)) return "🎬";
  if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "🎧";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜";
  return "📄";
};
