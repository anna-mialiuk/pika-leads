/** Дрібні HTTP-хелпери для node:http */
import { COOKIE_SECURE } from "./config.mjs";

export const send = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function readBody(req, limit = 20 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > limit) {
        reject(new HttpError(413, "Слишком большой запрос"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, "Некорректный JSON"));
      }
    });
    req.on("error", reject);
  });
}

export const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();

export function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

export function cookieHeader(name, value, { maxAge = null, clear = false } = {}) {
  const parts = [`${name}=${clear ? "" : encodeURIComponent(value)}`, "Path=/api/admin", "HttpOnly", "SameSite=Strict"];
  if (COOKIE_SECURE) parts.push("Secure");
  if (clear) parts.push("Max-Age=0");
  else if (maxAge) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}
