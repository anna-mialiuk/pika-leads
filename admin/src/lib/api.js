/**
 * Запити до бекенда адмінки (/api/admin/*).
 * Сесія — у httpOnly-cookie; заголовок X-Requested-With обов'язковий (захист від CSRF).
 */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
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
    throw new ApiError(response.status, data.error || "Ошибка запроса");
  }
  return data;
}
