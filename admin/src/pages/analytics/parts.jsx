/** Спільні компоненти для вкладок аналітики: картки, бари, кільця, спарклайни */
import { t } from "../../lib/i18n";
import { ink } from "../../lib/theme";
import { fmtNum } from "./data";

// ---------- компоненти ----------
export function Card({ title, sub, right, className = "", children }) {
  return (
    <section className={`an-card ${className}`}>
      {(title || right) && (
        <div className="an-card__head">
          <div>
            {title && <div className="an-card__title">{title}</div>}
            {sub && <div className="an-card__sub">{sub}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, color = "var(--accent-ink)", trend }) {
  return (
    <div className="an-kpi">
      <div className="an-kpi__label">{label}</div>
      <div className="an-kpi__value" style={{ color }}>
        {value}
        {trend}
      </div>
      {sub && <div className="an-kpi__sub">{sub}</div>}
    </div>
  );
}

/** ▲ +10% / ▼ −14%; better="down" — коли зростання погане (CPA) */
export function Trend({ value, better = "up" }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = better === "up" ? up : !up;
  return (
    <span className={`an-trend ${Math.abs(value) < 0.5 ? "" : good ? "is-good" : "is-bad"}`}>
      {up ? "▲" : "▼"} {up ? "+" : "−"}
      {fmtNum(Math.abs(value), Math.abs(value) < 10 ? 1 : 0)}%
    </span>
  );
}

export function Bar({ value, max, color = "var(--accent)", height = 6 }) {
  const w = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="an-bar" style={{ height }}>
      <div style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

/** Рядок «назва · значення» з баром */
export function BarRow({ label, value, sub, pct, color, dot }) {
  return (
    <div className="an-barrow">
      <div className="an-barrow__top">
        <span className="an-barrow__label">
          {dot && <i style={{ background: dot }} />}
          {label}
        </span>
        <span className="an-barrow__value">
          {value}
          {sub && <span className="faint"> · {sub}</span>}
        </span>
      </div>
      <Bar value={pct} max={100} color={color} />
    </div>
  );
}

export function Ring({ value, max = 100, size = 96, stroke = 10, color, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, value / max));
  return (
    <div className="an-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="an-ring__center">
        <b style={{ color: ink(color) }}>{label ?? Math.round(value)}</b>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

/** Кільцева діаграма з сегментами */
export function Donut({ parts, size = 150, stroke = 30 }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // зсув кожного сегмента — сума попередніх
  const segs = parts.map((p, i) => ({ ...p, len: (p.value / total) * c, offset: parts.slice(0, i).reduce((s, x) => s + (x.value / total) * c, 0) }));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="an-donut" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      {segs.map((p) => (
        <circle
          key={p.label}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={p.color}
          strokeWidth={stroke}
          strokeDasharray={`${p.len} ${c - p.len}`}
          strokeDashoffset={-p.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  );
}

/** Міні-стовпчики */
export function Spark({ values, color = "var(--accent)", height = 34 }) {
  const max = Math.max(1, ...values);
  return (
    <div className="an-spark" style={{ height }}>
      {values.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: color }} />
      ))}
    </div>
  );
}

/** Вертикальні стовпчики з підписами */
export function Columns({ items, height = 150, color = "var(--accent)", showValues = false, format = (v) => v }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="an-cols" style={{ height }}>
      {items.map((item, i) => (
        <div key={item.key ?? i} className="an-cols__col" title={`${item.label ?? ""} ${format(item.value)}`}>
          {showValues && <span className="an-cols__val">{format(item.value)}</span>}
          <i style={{ height: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color || color }} />
          {item.label !== undefined && <span className="an-cols__label">{item.label}</span>}
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="an-empty">{children}</div>;
}

export function Loading() {
  return (
    <div className="an-loading">
      <div className="spinner" />
    </div>
  );
}

export function Switch({ on, onChange, disabled, label, color }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`ts-switch ${on ? "is-on" : ""}`}
      style={on && color ? { background: color, borderColor: color } : undefined}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

/** Підказка «Подключите …» для блоків, яким потрібен GA4/Clarity */
export function NeedSource({ name, onGo }) {
  return (
    <div className="an-need">
      <span>{name === "ga" ? t("Нужен Google Analytics 4") : t("Нужен Microsoft Clarity")}</span>
      {onGo && (
        <button type="button" className="an-link" onClick={onGo}>
          {t("Подключить →")}
        </button>
      )}
    </div>
  );
}

