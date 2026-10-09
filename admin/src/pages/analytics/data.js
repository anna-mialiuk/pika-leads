/** Дані й форматування для вкладок аналітики (без компонентів) */
import { useEffect, useState } from "react";

import { api } from "../../lib/api";
import { LOCALE, t } from "../../lib/i18n";

// ---------- форматування ----------
export const fmtNum = (n, digits = 0) =>
  Number.isFinite(Number(n)) ? Number(n).toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : "—";

export function fmtMoney(n, currency = "USD", digits) {
  if (!Number.isFinite(Number(n))) return "—";
  const value = Number(n);
  const d = digits ?? (Math.abs(value) < 100 ? 1 : 0);
  try {
    return value.toLocaleString(LOCALE, { style: "currency", currency, maximumFractionDigits: d, minimumFractionDigits: 0 });
  } catch {
    return `${fmtNum(value, d)} ${currency}`;
  }
}

export const fmtPct = (n, digits = 1) => (Number.isFinite(Number(n)) ? `${fmtNum(n, digits)}%` : "—");

/** «2:38» з секунд */
export const fmtDur = (sec) => {
  const s = Math.round(Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

/** Δ у відсотках між двома значеннями */
export const deltaPct = (now, prev) => (prev ? ((now - prev) / prev) * 100 : null);

// ---------- кольори ----------
export const PLATFORM = {
  meta: { label: "Meta Ads", short: "Meta", color: "#0866FF" },
  google: { label: "Google Ads", short: "Google", color: "#34A853" },
  tiktok: { label: "TikTok Ads", short: "TikTok", color: "#25F4EE" },
};

export const CAB_STATUS = {
  active: { label: t("Активен"), color: "#5ac878" },
  review: { label: t("На модерации"), color: "#6fa8ff" },
  payment: { label: t("Нужна оплата"), color: "#ff7d7d" },
  disabled: { label: t("Отключён"), color: "#f0a83e" },
  paused: { label: t("Пауза"), color: "#8a8f98" },
};

export const PALETTE = ["#4fd8c8", "#6fa8ff", "#FFC629", "#ff6fae", "#b98bff", "#f0883e", "#5ac878", "#8a8f98"];
export const NICHE_COLORS = { Медицина: "#5ac878", iGaming: "#b98bff", "E-commerce": "#6fa8ff", Telegram: "#25c8ee", Финансы: "#f0a83e" };
export const nicheColor = (n, i = 0) => NICHE_COLORS[n] || PALETTE[i % PALETTE.length];

// ---------- кеш запитів між вкладками ----------
const cache = new Map();

/** GET з кешем: { data, error, loading, reload, set } */
export function useApi(path, { ttl = 60_000, enabled = true } = {}) {
  const [res, setRes] = useState({ path: null, data: null, error: "" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !path) return undefined;
    const hit = cache.get(path);
    if (hit && hit.at > Date.now() - ttl && !tick) return undefined;
    let alive = true;
    api(path)
      .then((data) => {
        cache.set(path, { at: Date.now(), data });
        if (alive) setRes({ path, data, error: "" });
      })
      .catch((error) => alive && setRes({ path, data: null, error: error.message }));
    return () => {
      alive = false;
    };
  }, [path, tick, ttl, enabled]);

  const own = res.path === path;
  const data = (own && res.data) || cache.get(path)?.data || null;
  const error = own ? res.error : "";
  return {
    data,
    error,
    loading: enabled && !data && !error,
    reload: () => setTick((n) => n + 1),
    set: (next) => {
      cache.set(path, { at: Date.now(), data: next });
      setRes({ path, data: next, error: "" });
    },
  };
}

export const dropCache = (prefix = "") => {
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
};
