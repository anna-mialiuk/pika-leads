/** Розрахунки для кабінетів: health, діагностика портфеля, оцінка креативів, рішення та ідеї */
import { t, tt } from "../../lib/i18n";
import { deltaPct, fmtMoney } from "./data";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Здоров'я кабінету 0–100: статус, CPA відносно медіани, CTR, освоєння бюджету, тренд CPA */
export function healthOf(cab, median) {
  if (cab.status === "payment") return 30;
  if (cab.status === "disabled") return 18;
  if (cab.status === "review") return 52;
  if (cab.status === "paused") return 45;
  const s = cab.summary;
  let h = 100;
  if (median && s.cpa) h -= Math.max(0, s.cpa / median - 1) * 55;
  if (s.impressions) h -= Math.max(0, 1.8 - s.ctr) * 12;
  const use = cab.budget ? s.today.spend / cab.budget : 0.6;
  if (use > 1) h -= 10;
  if (use < 0.4 && cab.budget) h -= 6;
  const cpaT = deltaPct(s.cpa, s.prev.cpa);
  if (cpaT !== null && cpaT > 8) h -= cpaT * 0.5;
  if (cpaT !== null && cpaT < -8) h += 4;
  if (!s.spend) h -= 20;
  return Math.round(clamp(h, 8, 100));
}

export const healthColor = (h) => (h >= 70 ? "#5ac878" : h >= 45 ? "#FFC629" : "#ff7d7d");

export function diagnose(cabs, median, days) {
  const cur = cabs[0]?.currency || "USD";
  const spend = cabs.reduce((s, c) => s + c.summary.spend, 0);
  const leads = cabs.reduce((s, c) => s + c.summary.conv, 0);
  const todayConv = cabs.reduce((s, c) => s + c.summary.today.conv, 0);
  const budget = cabs.reduce((s, c) => s + (c.budget || 0), 0);
  const todaySpend = cabs.reduce((s, c) => s + c.summary.today.spend, 0);
  const now = new Date();
  const dayPart = Math.max(0.15, (now.getHours() * 60 + now.getMinutes()) / 1440);
  const proj = Math.round(todayConv / dayPart);
  const weights = cabs.reduce(
    (acc, c) => {
      const w = c.summary.spend + 1;
      acc.s += c.health * w;
      acc.w += w;
      return acc;
    },
    { s: 0, w: 0 },
  );
  const health = weights.w ? Math.round(weights.s / weights.w) : 0;
  const active = cabs.filter((c) => c.status === "active");
  const oppCab = active
    .filter((c) => c.summary.cpa > 0 && c.summary.cpa <= median)
    .sort((a, b) => b.summary.conv - a.summary.conv)[0];
  const riskCab = [...cabs].sort((a, b) => a.health - b.health)[0];
  const gain = oppCab ? Math.max(1, Math.round((oppCab.summary.conv / days) * 0.25)) : 0;
  return {
    cur,
    health,
    label: health >= 70 ? t("Портфель здоров") : health >= 45 ? t("Требует внимания") : t("Есть риски"),
    spend,
    leads,
    cpa: leads ? spend / leads : 0,
    proj,
    pacing: budget ? Math.round((todaySpend / budget) * 100) : null,
    active: active.length,
    opp: oppCab ? { cab: oppCab, text: tt("CPA {0} ниже медианы — при +25% бюджета ≈ +{1} лидов/день.", fmtMoney(oppCab.summary.cpa, oppCab.currency, 1), gain) } : null,
    risk:
      riskCab && riskCab.health < 70
        ? {
            cab: riskCab,
            text:
              riskCab.status !== "active"
                ? tt("Health {0}/100 — статус «{1}».", riskCab.health, riskCab.statusLabelT)
                : tt("Health {0}/100 — дорогой лид или слабый CTR.", riskCab.health),
          }
        : null,
  };
}

/** Оцінка креативу 0–100: CTR, ціна результату, конверсія кліку */
export function scoreCreative(ad, cpaRef = 12) {
  const ctr = ad.impressions ? (ad.clicks / ad.impressions) * 100 : 0;
  const cpr = ad.results ? ad.spend / ad.results : 0;
  const cvr = ad.clicks ? (ad.results / ad.clicks) * 100 : 0;
  const ctrScore = Math.min(1, ctr / 2.2);
  const top = cpaRef * 1.5;
  const cprScore = cpr ? clamp((top - cpr) / (top - cpaRef * 0.35), 0, 1) : 0;
  const cvrScore = Math.min(1, cvr / 4);
  const score = Math.round((ctrScore * 0.34 + cprScore * 0.42 + cvrScore * 0.24) * 100);
  let verdict;
  let color;
  let advice;
  if (score >= 72) {
    verdict = t("Масштабировать");
    color = "#5ac878";
    advice = t("Победитель — поднимайте бюджет +20–30% и дублируйте связку на похожие аудитории.");
  } else if (score >= 48) {
    verdict = t("Тест / докрутить");
    color = "#FFC629";
    advice = t("Рабочий, но не топ. Протестируйте новый первый кадр и оффер в заголовке.");
  } else {
    verdict = t("Заменить");
    color = "#ff7d7d";
    advice = t("Дорогой результат и низкая отдача — отключите и замените на свежий креатив.");
  }
  return { ctr, cpr, cvr, cpm: ad.impressions ? (ad.spend / ad.impressions) * 1000 : 0, score, verdict, color, advice };
}

/** Рішення за даними кабінетів */
export function decisionsOf(cabs, median) {
  const out = [];
  for (const c of cabs.filter((x) => x.status === "active" && x.summary.spend > 0)) {
    const s = c.summary;
    if (median && s.cpa && s.cpa <= median * 0.8) out.push({ prio: t("Масштабировать"), color: "#5ac878", acc: c.name, text: tt("Дешёвый лид {0} при CTR {1}% — поднять бюджет и дублировать связку.", fmtMoney(s.cpa, c.currency, 1), s.ctr) });
    else if (median && s.cpa >= median * 1.4) out.push({ prio: t("Оптимизировать"), color: "#ff7d7d", acc: c.name, text: tt("Дорогой лид {0} — сузить аудиторию, обновить креатив, проверить посадочную.", fmtMoney(s.cpa, c.currency, 1)) });
    else if (s.impressions > 1000 && s.ctr < 1.2) out.push({ prio: t("Обновить креатив"), color: "#FFC629", acc: c.name, text: tt("CTR {0}% ниже нормы — усталость связки, нужен свежий креатив.", s.ctr) });
  }
  return out;
}

/** Стартові ідеї (без AI) на базі даних */
export function ideaBank(kind, cabs, creatives) {
  const active = cabs.filter((c) => c.status === "active" && c.summary.cpa > 0);
  const best = [...active].sort((a, b) => a.summary.cpa - b.summary.cpa)[0];
  const worst = [...active].sort((a, b) => b.summary.cpa - a.summary.cpa)[0];
  const top = creatives[0];
  const bank = {
    offers: [
      { t: t("Гарантия результата в оффер"), why: best ? tt("«{0}» даёт CPA {1} — упакуйте это как «платите за результат» на посадочной.", best.name, fmtMoney(best.summary.cpa, best.currency, 1)) : t("Свяжите оффер с реальным CPA лучшего кабинета."), tag: "сильный" },
      { t: t("Оффер с дедлайном / ограничением"), why: t("Кабинеты с высоким CTR лучше конвертят срочность — добавьте таймер и лимит мест."), tag: "тест" },
      { t: t("Разбить оффер по нишам"), why: worst ? tt("«{0}» с CPA {1} тянет вниз — вынесите его нишу в отдельный оффер со своим лид-магнитом.", worst.name, fmtMoney(worst.summary.cpa, worst.currency, 1)) : t("Отделите слабую нишу в самостоятельный оффер."), tag: "фикс" },
      { t: t("Бандл: услуга + бесплатный аудит"), why: t("Снижает порог входа, поднимает конверсию клика в лид на холодном трафике."), tag: "рост" },
    ],
    texts: [
      { t: t("Заголовок с цифрой результата"), why: top ? tt("Топ-креатив «{0}» с оценкой {1} — вынесите его цифру в первый экран текста.", top.name, top.score) : t("Начните текст с конкретной измеримой цифры результата."), tag: "сильный" },
      { t: t("Боль → решение → доказательство"), why: t("Структура даёт лучший CTR на связках с холодной аудиторией."), tag: "рост" },
      { t: t("Первые 3 секунды — крючок"), why: t("Для видео-плейсментов удержание падает после 3с — перепишите вступление."), tag: "тест" },
      { t: t("Локальный триггер (гео)"), why: t("Упомяните город/страну кабинета — повышает релевантность и снижает CPM."), tag: "фикс" },
    ],
    creatives: [
      { t: t("Дублировать формат победителя"), why: top ? tt("«{0}» — лучший по оценке, снимите 3 вариации того же формата.", top.name) : t("Найдите лучший формат и сделайте вариации."), tag: "сильный" },
      { t: t("UGC / отзыв клиента"), why: t("Живое видео-доказательство обычно снижает цену за результат на 15–25%."), tag: "рост" },
      { t: t("Статик с оффером крупно"), why: t("Дешёвый в проде тест гипотез оффера перед вложением в видео."), tag: "тест" },
      { t: t("Обновить уставшие креативы"), why: t("Креативы с падающим CTR — замена вернёт охват и снизит частоту."), tag: "фикс" },
    ],
  };
  return bank[kind] || bank.offers;
}

export const IDEA_TAG_COLORS = { сильный: "#5ac878", рост: "#c69bff", тест: "#FFC629", фикс: "#ff7d7d" };
export const RULE_TAG_COLORS = { защита: "#ff7d7d", рост: "#5ac878", бюджет: "#FFC629", качество: "#6fa8ff" };
export const ACTION_LABELS = {
  notify: t("Уведомить в Telegram"),
  pause: t("Остановить кампанию"),
  budget_up: t("Поднять бюджет"),
  budget_down: t("Снизить бюджет"),
  duplicate: t("Дублировать связку"),
  creative: t("Заменить креатив"),
};
export const TAG_LABELS = { защита: t("защита"), рост: t("рост"), бюджет: t("бюджет"), качество: t("качество"), сильный: t("сильный"), тест: t("тест"), фикс: t("фикс") };
export const METRIC_LABELS = { "Расход дня": t("Расход дня"), Конверсии: t("Конверсии") };
export const UNIT_LABELS = { бюджет: t("бюджет"), "": t("без") };

export function ruleCondition(r) {
  const metric = METRIC_LABELS[r.metric] || r.metric;
  let val;
  if (r.unit === "бюджет") val = t("бюджет");
  else if (r.unit === "$") val = `$${r.val}`;
  else if (r.unit === "%") val = `${r.val}%`;
  else val = String(r.val);
  return [metric, r.op, val, r.window].filter(Boolean).join(" ");
}

export function ruleAction(r) {
  const base = ACTION_LABELS[r.actionType] || r.actionType;
  if ((r.actionType === "budget_up" || r.actionType === "budget_down") && r.amount) return `${base} ${r.actionType === "budget_up" ? "+" : "−"}${r.amount}% ${t("/ день")}`;
  if (r.actionType === "duplicate" && r.amount) return `${base} (+${r.amount}% ${t("бюджет")})`;
  return base;
}
