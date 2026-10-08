import Icon from "./Icon";
import { CopyButton } from "./ui";
import { contactsOf } from "../lib/format";
import { useMeta } from "../lib/meta";

/** Кнопки швидкого зв'язку з лідом */
export function ContactButtons({ lead, compact = false }) {
  const c = contactsOf(lead);
  const stop = (event) => event.stopPropagation();
  return (
    <div className={`contact-buttons ${compact ? "contact-buttons--compact" : ""}`} onClick={stop}>
      {c.phone && <CopyButton value={c.phone} label={`Скопировать ${c.phone}`} />}
      {c.call && (
        <a className="icon-btn icon-btn--call" href={c.call} title="Позвонить" aria-label="Позвонить">
          <Icon name="phone" />
        </a>
      )}
      {c.telegram && (
        <a className="icon-btn icon-btn--tg" href={c.telegram} target="_blank" rel="noreferrer" title="Telegram" aria-label="Telegram">
          <Icon name="telegram" />
        </a>
      )}
      {c.whatsapp && (
        <a className="icon-btn icon-btn--wa" href={c.whatsapp} target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp">
          <Icon name="whatsapp" />
        </a>
      )}
      {c.viber && (
        <a className="icon-btn icon-btn--viber" href={c.viber} title="Viber" aria-label="Viber">
          <Icon name="viber" />
        </a>
      )}
      {c.mail && (
        <a className="icon-btn" href={c.mail} title={c.email} aria-label="Email">
          <Icon name="mail" />
        </a>
      )}
    </div>
  );
}

/** Статус: кольоровий список-вибір */
export function StatusSelect({ value, onChange, size = "md" }) {
  const { statuses, statusByCode } = useMeta();
  const status = statusByCode[value] || statuses[0];
  return (
    <select
      className={`status-select status-select--${size}`}
      value={value}
      style={{ "--status": status.color }}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Статус"
    >
      {statuses.map((s) => (
        <option key={s.code} value={s.code}>
          {s.emoji} {s.label}
        </option>
      ))}
    </select>
  );
}

export function StatusBadge({ code }) {
  const { statusByCode } = useMeta();
  const status = statusByCode[code];
  if (!status) return null;
  return (
    <span className="badge" style={{ background: `${status.color}22`, color: status.color }}>
      {status.emoji} {status.label}
    </span>
  );
}

/** Вибір менеджера */
export function ManagerSelect({ value, onChange, className = "select select--sm" }) {
  const { users } = useMeta();
  return (
    <select
      className={className}
      value={value ?? ""}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      aria-label="Менеджер"
    >
      <option value="">— не назначен —</option>
      {users
        .filter((u) => !u.disabled || u.id === value)
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
    </select>
  );
}
