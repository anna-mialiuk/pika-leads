/**
 * Відправка листів через SMTP (без залежностей): з'єднання одразу по TLS (порт 465),
 * AUTH PLAIN, лист UTF-8 (текст + HTML).
 * Підходить Gmail (пароль застосунку), Brevo, Resend, пошта хостингу — будь-який SMTP з портом 465.
 *
 * .env: SMTP_HOST, SMTP_PORT=465, SMTP_USER, SMTP_PASS, MAIL_FROM (за замовчуванням SMTP_USER), MAIL_FROM_NAME
 */
import crypto from "node:crypto";
import tls from "node:tls";

import { MAIL_FROM, MAIL_FROM_NAME, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER } from "./config.mjs";

export const mailConfigured = () => Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const clean = (value) => String(value || "").replace(/[\r\n]/g, " ");
const encodeWord = (text) => `=?UTF-8?B?${Buffer.from(clean(text)).toString("base64")}?=`;
const base64Lines = (text) =>
  Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n");

function buildMessage({ from, fromName, to, subject, text, html }) {
  const boundary = `pl-${crypto.randomBytes(12).toString("hex")}`;
  const domain = from.split("@")[1] || "localhost";
  const headers = [
    `From: ${encodeWord(fromName)} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type, body) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", base64Lines(body)].join("\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${part("text/plain", text)}\r\n${part("text/html", html)}\r\n--${boundary}--\r\n`;
}

/** Діалог із SMTP-сервером: команда → очікуваний код відповіді */
function smtpSession(socket) {
  let buffer = "";
  let waiting = null;
  const lines = [];

  const flush = () => {
    if (!waiting) return;
    const index = lines.findIndex((line) => /^\d{3} /.test(line));
    if (index < 0) return;
    const reply = lines.splice(0, index + 1);
    const code = Number(reply[index].slice(0, 3));
    const { resolve, reject, expect } = waiting;
    waiting = null;
    if (expect.includes(code)) resolve(reply.join("\n"));
    else reject(new Error(`SMTP ${reply[index]}`));
  };

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let index;
    while ((index = buffer.indexOf("\r\n")) >= 0) {
      lines.push(buffer.slice(0, index));
      buffer = buffer.slice(index + 2);
    }
    flush();
  });

  const fail = (error) => {
    if (waiting) {
      waiting.reject(error);
      waiting = null;
    }
  };
  socket.on("error", fail);
  socket.on("close", () => fail(new Error("SMTP: соединение закрыто")));

  return (command, expect) =>
    new Promise((resolve, reject) => {
      waiting = { resolve, reject, expect: [].concat(expect) };
      if (command !== null) socket.write(`${command}\r\n`);
      flush();
    });
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) throw new Error("Почта не настроена (SMTP_* в .env)");
  const from = clean(MAIL_FROM || SMTP_USER);
  const recipient = clean(to);
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(recipient)) throw new Error("Некорректный адрес получателя");

  const socket = tls.connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST });
  socket.setTimeout(20_000, () => socket.destroy(new Error("SMTP: таймаут")));
  const say = smtpSession(socket);

  try {
    await say(null, 220);
    await say(`EHLO ${from.split("@")[1] || "localhost"}`, 250);
    await say(`AUTH PLAIN ${Buffer.from(`\0${SMTP_USER}\0${SMTP_PASS}`).toString("base64")}`, 235);
    await say(`MAIL FROM:<${from}>`, 250);
    await say(`RCPT TO:<${recipient}>`, [250, 251]);
    await say("DATA", 354);
    const message = buildMessage({ from, fromName: MAIL_FROM_NAME, to: recipient, subject, text, html })
      .split("\r\n")
      .map((line) => (line.startsWith(".") ? `.${line}` : line))
      .join("\r\n");
    await say(`${message}\r\n.`, 250);
    await say("QUIT", 221).catch(() => {});
  } finally {
    socket.end();
  }
}
