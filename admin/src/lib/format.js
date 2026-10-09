import { t, tt } from "./i18n";
const pad = (n) => String(n).padStart(2, "0");

export function formatDate(iso, { time = true } = {}) {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return time ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t("только что");
  if (diff < 3600) return tt("{0} мин назад", Math.floor(diff / 60));
  if (diff < 86400) return tt("{0} ч назад", Math.floor(diff / 3600));
  if (diff < 86400 * 7) return tt("{0} дн назад", Math.floor(diff / 86400));
  return formatDate(iso, { time: false });
}

const digits = (value) => String(value || "").replace(/\D/g, "");

/** Контакти ліда й посилання для швидкого зв'язку */
export function contactsOf(lead) {
  const data = lead.data || {};
  const phone = data.phone_full || data.phone || "";
  const phoneDigits = digits(phone);
  const tgRaw = String(data.telegram || data.messenger || "").trim();
  const tgUser = /^@?[A-Za-z]\w{3,}$/.test(tgRaw) ? tgRaw.replace(/^@/, "") : "";

  return {
    phone,
    email: data.email || "",
    telegramText: tgRaw,
    call: phoneDigits.length >= 7 ? `tel:+${phoneDigits}` : null,
    telegram: tgUser ? `https://t.me/${tgUser}` : phoneDigits.length >= 7 ? `https://t.me/+${phoneDigits}` : null,
    whatsapp: phoneDigits.length >= 7 ? `https://wa.me/${phoneDigits}` : null,
    viber: phoneDigits.length >= 7 ? `viber://chat?number=%2B${phoneDigits}` : null,
    mail: data.email ? `mailto:${data.email}` : null,
  };
}

export const leadName = (lead) =>
  lead.data?.name || lead.data?.phone_full || lead.data?.phone || lead.data?.email || lead.data?.telegram || tt("Заявка #{0}", lead.id);

/** Джерело для таблиці: utm_source → «Сайт» */
export function sourceOf(lead) {
  const a = lead.attribution || {};
  if (lead.type === "manual") return { main: lead.source || t("Вручную"), sub: t("добавлен вручную") };
  return {
    main: a.utm_source || (a.gclid ? "Google Ads" : a.fbclid ? "Meta" : a.ttclid ? "TikTok" : t("Сайт")),
    sub: a.utm_campaign || lead.page || "",
  };
}

/** Простий пошук по ліду */
export function matchesSearch(lead, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const hay = [
    `#${lead.id}`,
    String(lead.id),
    ...Object.values(lead.data || {}).flat(),
    lead.attribution?.utm_campaign,
    lead.attribution?.utm_source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  const qd = digits(q);
  return qd.length >= 4 && digits(lead.data?.phone_full || lead.data?.phone).includes(qd);
}

/** Оцінка надійності пароля (як на сервері): 0…4 */
export function passwordScore(password) {
  const p = String(password || "");
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-ZА-ЯІЇЄҐ]/.test(p) && /[a-zа-яіїєґ]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-zА-Яа-яІЇЄҐіїєґ0-9]/.test(p)) score++;
  return score;
}
