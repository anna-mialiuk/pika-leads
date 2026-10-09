/**
 * Claude API для AI-помічника байєра: відповіді на питання, ідеї, чернетки апеляцій і постів.
 * Ключ — ANTHROPIC_API_KEY у .env сервера (у браузер не потрапляє).
 */
import { AI_MODEL, ANTHROPIC_API_KEY, ANTHROPIC_API_URL } from "./config.mjs";
import { HttpError } from "./http.mjs";

export const aiReady = () => Boolean(ANTHROPIC_API_KEY);

const LANG_NAME = { uk: "украинском", ru: "русском" };

/** Системний промпт: роль + мова відповіді */
const systemFor = (lang, extra = "") =>
  [
    "Ты — AI-помощник медиабайера в performance-агентстве Pika Leads (Meta Ads, Google Ads, TikTok Ads, лидогенерация).",
    "Опирайся только на переданные данные кабинетов и CRM; если данных не хватает — так и скажи, не выдумывай цифры.",
    "Пиши коротко и по делу, с конкретными действиями.",
    `Отвечай на ${LANG_NAME[lang] || LANG_NAME.ru} языке.`,
    extra,
  ]
    .filter(Boolean)
    .join("\n");

export async function aiText({ lang = "ru", system = "", messages, maxTokens = 900 }) {
  if (!aiReady()) throw new HttpError(400, "AI не подключён: добавьте ANTHROPIC_API_KEY в .env сервера");
  let response;
  try {
    response = await fetch(`${ANTHROPIC_API_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, system: systemFor(lang, system), messages }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new HttpError(502, `AI недоступен: ${error.message}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error?.message || `HTTP ${response.status}`;
    throw new HttpError(502, `Ошибка AI: ${message}`);
  }
  return (body.content || [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/** Відповідь у JSON: просимо лише JSON і акуратно вирізаємо його з тексту */
export async function aiJson({ lang, system = "", prompt, maxTokens = 1200 }) {
  const text = await aiText({
    lang,
    system: `${system}\nОтвет — строго валидный JSON без пояснений и без markdown.`,
    messages: [{ role: "user", content: prompt }],
    maxTokens,
  });
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new HttpError(502, "AI вернул некорректный ответ — попробуйте ещё раз");
  }
}
