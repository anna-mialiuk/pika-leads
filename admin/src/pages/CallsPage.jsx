import { useCallback, useEffect, useMemo, useState } from "react";

import { TasksHeader } from "../components/TasksShell";
import { Modal } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useMeta } from "../lib/meta";
import { useProjects } from "../lib/projects";
import { useTasks } from "../lib/tasks";

import "../components/Projects.css";
import "./CallsPage.css";
import { t, tt } from "../lib/i18n";

const START_H = 8;
const END_H = 21;
const ROW = 56; // px на годину
const WEEK_NAMES = [t("Пн"), t("Вт"), t("Ср"), t("Чт"), t("Пт"), t("Сб"), t("Вс")];
const MONTHS_GEN = [t("января"), t("февраля"), t("марта"), t("апреля"), t("мая"), t("июня"), t("июля"), t("августа"), t("сентября"), t("октября"), t("ноября"), t("декабря")];
const MONTHS_SHORT = [t("янв"), t("фев"), t("мар"), t("апр"), t("май"), t("июн"), t("июл"), t("авг"), t("сен"), t("окт"), t("ноя"), t("дек")];

export const VIDEO = {
  zoom: { label: "Zoom", color: "#2D8CFF", create: "https://zoom.us/meeting/schedule", hint: t("Запланируйте встречу в Zoom и вставьте ссылку") },
  googlemeet: { label: "Meet", color: "#00AC47", create: "https://meet.google.com/new", hint: t("Откроется новая встреча Google Meet — скопируйте её ссылку сюда") },
  loom: { label: "Loom", color: "#625DF5", create: "https://www.loom.com/looms/videos", hint: t("Вставьте ссылку на Loom") },
};
const DURATIONS = [15, 30, 45, 60, 90, 120];
const MINUTES = ["00", "15", "30", "45"];
const HOURS = Array.from({ length: 16 }, (_, i) => String(i + 7).padStart(2, "0"));

const pad = (n) => String(n).padStart(2, "0");
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayOf = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const range = (m) => {
  const start = new Date(m.startAt);
  return `${hm(start)}–${hm(new Date(start.getTime() + m.duration * 60_000))}`;
};
const style = (m) =>
  m.type === "call"
    ? { dot: "#5b9bff", bg: "rgba(91,155,255,0.14)", bd: "rgba(91,155,255,0.5)" }
    : { dot: "#FFC629", bg: "rgba(255,198,41,0.15)", bd: "rgba(255,198,41,0.55)" };

// посилання «своєї кімнати» в кожному сервісі запам'ятовуємо в цьому браузері
const savedLink = (video) => {
  try {
    return localStorage.getItem(`meet-link-${video}`) || "";
  } catch {
    return "";
  }
};
const rememberLink = (video, link) => {
  try {
    if (video && link) localStorage.setItem(`meet-link-${video}`, link);
  } catch {
    /* приватний режим */
  }
};

/* ================= вікно зустрічі ================= */

function MeetModal({ meeting, defaults = {}, onClose, onSaved }) {
  const { user } = useAuth();
  const { settings: taskSettings } = useTasks();
  // кімната команди з «Настроек» (автоссылка), інакше — остання в цьому браузері
  const roomLink = (video) =>
    (taskSettings?.settings.autoLink !== false && taskSettings?.settings.video?.[video]?.link) || savedLink(video);
  const { users } = useMeta();
  const { projects } = useProjects();
  const team = users.filter((u) => !u.disabled);
  const [form, setForm] = useState(() => {
    const start = meeting ? new Date(meeting.startAt) : defaults.start || (() => {
      const d = new Date(Date.now() + 3600_000);
      d.setMinutes(0, 0, 0);
      return d;
    })();
    const video = meeting ? meeting.video : "zoom";
    return {
      title: meeting?.title ?? "",
      day: isoDay(start),
      hour: pad(start.getHours()),
      minute: MINUTES.includes(pad(start.getMinutes())) ? pad(start.getMinutes()) : "00",
      duration: meeting?.duration ?? 60,
      type: meeting?.type ?? "meeting",
      video,
      link: meeting ? meeting.link : roomLink(video),
      attendees: meeting?.attendees ?? [user.id],
      projectId: meeting?.projectId ?? "",
    };
  });
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const canDelete = meeting && (user.role === "admin" || meeting.createdBy?.userId === user.id);

  const save = async () => {
    setError("");
    if (!form.title.trim()) return setError(t("Укажите название встречи"));
    if (form.link && !/^https:\/\//i.test(form.link.trim())) return setError(t("Ссылка должна начинаться с https://"));
    const [y, mo, d] = form.day.split("-").map(Number);
    const start = new Date(y, mo - 1, d, Number(form.hour), Number(form.minute));
    if (Number.isNaN(start.getTime())) return setError(t("Укажите день"));
    const body = {
      title: form.title.trim(),
      startAt: start.toISOString(),
      duration: Number(form.duration),
      type: form.type,
      video: form.video,
      link: form.video ? form.link.trim() : "",
      attendees: form.attendees,
      projectId: form.projectId || null,
    };
    setBusy(true);
    try {
      if (meeting) await api(`/meetings/${meeting.id}`, { method: "PATCH", body });
      else await api("/meetings", { method: "POST", body });
      rememberLink(form.video, body.link);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const del = async () => {
    if (!window.confirm(t("Удалить встречу? Участники получат уведомление об отмене."))) return;
    try {
      await api(`/meetings/${meeting.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(form.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Modal title={meeting ? t("Редактировать встречу") : t("Запланировать встречу")} onClose={onClose} className="task-modal proj-modal">
      <fieldset className="task-modal__body" disabled={busy}>
        <input
          className="tm-input tm-input--top pm-big"
          placeholder={t("Название встречи")}
          value={form.title}
          autoFocus={!meeting}
          onChange={(e) => set({ title: e.target.value })}
        />
        <div className="mm-grid mm-grid--day">
          <label className="tm-field">
            <span className="tm-label">{t("День")}</span>
            <input className="tm-input" type="date" value={form.day} onChange={(e) => set({ day: e.target.value })} />
          </label>
          <div className="tm-field">
            <span className="tm-label">{t("Начало")}</span>
            <div className="mm-time">
              <select className="tm-input" value={form.hour} onChange={(e) => set({ hour: e.target.value })} aria-label={t("Час")}>
                {HOURS.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
              <b>:</b>
              <select className="tm-input" value={form.minute} onChange={(e) => set({ minute: e.target.value })} aria-label={t("Минуты")}>
                {MINUTES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mm-grid">
          <label className="tm-field">
            <span className="tm-label">{t("Длительность")}</span>
            <select className="tm-input" value={form.duration} onChange={(e) => set({ duration: Number(e.target.value) })}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? tt("{0} мин", d) : d === 60 ? t("1 час") : tt("{0} ч", d / 60).replace(".5", ",5")}
                </option>
              ))}
            </select>
          </label>
          <label className="tm-field">
            <span className="tm-label">{t("Тип")}</span>
            <select className="tm-input" value={form.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="meeting">{t("Митинг")}</option>
              <option value="call">{t("Звонок")}</option>
            </select>
          </label>
        </div>
        <label className="tm-field">
          <span className="tm-label">{t("Сервис видеосвязи")}</span>
          <select
            className="tm-input"
            value={form.video}
            onChange={(e) => set({ video: e.target.value, link: e.target.value ? roomLink(e.target.value) : "" })}
          >
            <option value="zoom">Zoom</option>
            <option value="googlemeet">Google Meet</option>
            <option value="loom">Loom</option>
            <option value="">{t("Без видео")}</option>
          </select>
        </label>
        {form.video && (
          <div className="mm-link">
            <div className="mm-link__head">
              <span>🔗 {VIDEO[form.video].hint}</span>
              <a href={VIDEO[form.video].create} target="_blank" rel="noopener noreferrer">{t("↗ Создать")}</a>
            </div>
            <div className="mm-link__row">
              <input
                className="mono"
                value={form.link}
                placeholder="https://…"
                onChange={(e) => set({ link: e.target.value })}
                aria-label={t("Ссылка на звонок")}
              />
              {form.link && (
                <button type="button" onClick={copy}>
                  {copied ? t("✓ Скоп.") : t("⧉ Копир.")}
                </button>
              )}
            </div>
          </div>
        )}
        <label className="tm-field">
          <span className="tm-label">{t("Проект")}</span>
          <select className="tm-input" value={form.projectId} onChange={(e) => set({ projectId: e.target.value ? Number(e.target.value) : "" })}>
            <option value="">{t("— без проекта —")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="tm-label">{t("Участники")}</div>
        <div className="tm-chips mm-chips">
          {team.map((u) => {
            const on = form.attendees.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                className={`tm-chip ${on ? "is-on" : ""}`}
                aria-pressed={on}
                onClick={() => set({ attendees: on ? form.attendees.filter((id) => id !== u.id) : [...form.attendees, u.id] })}
              >
                {u.name}
              </button>
            );
          })}
        </div>
        <p className="mm-note">{t("Участникам с подключённым Telegram придёт приглашение, а за 15 минут — напоминание со ссылкой.")}</p>
        {error && <div className="alert">⚠ {error}</div>}
        <div className="tm-actions">
          <button type="button" className="tm-save pm-save" onClick={save}>
            {busy ? t("Сохраняем…") : meeting ? t("Сохранить") : t("Создать встречу")}
          </button>
          <button type="button" className="tm-btn" onClick={onClose}>{t("Отмена")}</button>
          {canDelete && (
            <button type="button" className="tm-btn tm-btn--danger" onClick={del} title={t("Удалить")} aria-label={t("Удалить встречу")}>
              ✕
            </button>
          )}
        </div>
      </fieldset>
    </Modal>
  );
}

/* ================= сторінка ================= */

function CallsPage() {
  const { userById } = useMeta();
  const [meetings, setMeetings] = useState(null);
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [modal, setModal] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(
    () =>
      api("/meetings")
        .then(({ meetings: list }) => setMeetings(list))
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
    const id = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const weekEnd = addDays(week, 7);
  const todayKey = isoDay(new Date(now));
  const byDay = useMemo(() => {
    const map = {};
    for (const m of meetings || []) (map[isoDay(new Date(m.startAt))] ||= []).push(m);
    Object.values(map).forEach((l) => l.sort((a, b) => (a.startAt < b.startAt ? -1 : 1)));
    return map;
  }, [meetings]);

  const last = days[6];
  const label =
    week.getMonth() === last.getMonth()
      ? `${week.getDate()}–${last.getDate()} ${MONTHS_GEN[last.getMonth()]} ${last.getFullYear()}`
      : `${week.getDate()} ${MONTHS_GEN[week.getMonth()]} – ${last.getDate()} ${MONTHS_GEN[last.getMonth()]} ${last.getFullYear()}`;

  const upcoming = (meetings || [])
    .filter((m) => new Date(m.startAt).getTime() + m.duration * 60_000 > now)
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
    .slice(0, 12);

  const att = (m) => tt("{0} уч.", m.attendees.length);
  const names = (m) =>
    m.attendees
      .map((id) => userById[id]?.name)
      .filter(Boolean)
      .join(", ");
  const dayLabel = (d) => `${WEEK_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;

  const copy = (m) =>
    navigator.clipboard?.writeText(m.link).then(() => {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1500);
    });

  const weekMeetings = (meetings || []).filter((m) => {
    const t = new Date(m.startAt);
    return t >= week && t < weekEnd;
  });

  return (
    <div className="tboard-page">
      <TasksHeader action={{ label: t("+ Встреча"), onClick: () => setModal({}) }} />

      <div className="cl-bar">
        <div className="cl-bar__week">
          <button type="button" onClick={() => setWeek(addDays(week, -7))} aria-label={t("Предыдущая неделя")}>
            ‹
          </button>
          <button type="button" onClick={() => setWeek(addDays(week, 7))} aria-label={t("Следующая неделя")}>
            ›
          </button>
          {isoDay(week) !== isoDay(mondayOf(new Date(now))) && (
            <button type="button" className="cl-bar__today" onClick={() => setWeek(mondayOf(new Date()))}>{t("Сегодня")}</button>
          )}
          <span>{t("Неделя")}{" "}{label}{" "}{t("· планирование звонков и митингов команды")}</span>
        </div>
        <div className="cl-legend">
          <span>
            <i style={{ background: "#FFC629" }} />{t("Митинг")}</span>
          <span>
            <i style={{ background: "#5b9bff" }} />{t("Звонок")}</span>
        </div>
      </div>

      {error && <div className="alert">⚠ {error}</div>}

      <div className="cl-week">
        <div className="cl-week__head">
          <div />
          {days.map((d) => (
            <div key={d} className={isoDay(d) === todayKey ? "is-today" : ""}>
              <b>{WEEK_NAMES[(d.getDay() + 6) % 7]}</b>
              <span>
                {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
              </span>
            </div>
          ))}
        </div>
        <div className="cl-week__body">
          <div className="cl-week__gutter">
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <div key={i} style={{ height: ROW }}>
                {pad(START_H + i)}:00
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              className={`cl-week__day ${isoDay(d) === todayKey ? "is-today" : ""}`}
              style={{ height: (END_H - START_H) * ROW }}
            >
              {Array.from({ length: END_H - START_H }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className="cl-week__slot"
                  style={{ height: ROW }}
                  aria-label={tt("Новая встреча {0} {1}:00", dayLabel(d), pad(START_H + i))}
                  onClick={() => setModal({ defaults: { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), START_H + i) } })}
                />
              ))}
              {(byDay[isoDay(d)] || []).map((m) => {
                const start = new Date(m.startAt);
                const minutes = start.getHours() * 60 + start.getMinutes();
                const top = Math.max(0, ((minutes - START_H * 60) / 60) * ROW);
                const height = Math.max(24, (m.duration / 60) * ROW - 3);
                const s = style(m);
                const video = VIDEO[m.video];
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="cl-event"
                    title={`${m.title}${names(m) ? ` · ${names(m)}` : ""}`}
                    style={{ top: Math.min(top, (END_H - START_H) * ROW - 24), height, background: s.bg, borderColor: s.bd, borderLeftColor: s.dot }}
                    onClick={() => setModal({ meeting: m })}
                  >
                    <div className="cl-event__title">{m.title}</div>
                    <div className="cl-event__time">{range(m)}</div>
                    {height >= 56 && (
                      <div className="cl-event__meta">
                        {video && m.link && (
                          <span className="cl-video" style={{ background: video.color }}>
                            📹 {video.label}
                          </span>
                        )}
                        <span>{att(m)}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* телефон: список днів тижня */}
      <div className="cl-agenda">
        {weekMeetings.length === 0 && <div className="cl-agenda__empty">{t("На этой неделе встреч нет")}</div>}
        {days
          .filter((d) => byDay[isoDay(d)]?.length)
          .map((d) => (
            <div key={d} className="tcal-agenda__day">
              <div className="tcal-agenda__date">
                <div className={isoDay(d) === todayKey ? "is-today" : ""}>{d.getDate()}</div>
                <span>{WEEK_NAMES[(d.getDay() + 6) % 7]}</span>
              </div>
              <div className="tcal-agenda__items">
                {byDay[isoDay(d)].map((m) => {
                  const video = VIDEO[m.video];
                  return (
                    <div
                      key={m.id}
                      className="cl-agenda__item"
                      style={{ borderLeftColor: style(m).dot }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setModal({ meeting: m })}
                      onKeyDown={(e) => e.key === "Enter" && setModal({ meeting: m })}
                    >
                      <div className="cl-agenda__top">
                        <span className="mono">{range(m)}</span>
                        {video && m.link && (
                          <span className="cl-video" style={{ background: video.color }}>
                            📹 {video.label}
                          </span>
                        )}
                      </div>
                      <div className="cl-agenda__title">{m.title}</div>
                      <div className="cl-agenda__sub">
                        {m.duration}{" "}{t("мин ·")}{" "}{att(m)}
                      </div>
                      {m.link && (
                        <a className="cl-join" href={m.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t("Войти в звонок")}</a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      <div className="cl-upcoming">
        <div className="pd-section-title">{t("Ближайшие встречи · ссылки для подключения")}</div>
        {meetings && upcoming.length === 0 && <div className="pd-empty">{t("Встреч пока нет — нажмите «+ Встреча» или кликните по времени в сетке.")}</div>}
        <div className="cl-upcoming__list">
          {upcoming.map((m) => {
            const video = VIDEO[m.video];
            const start = new Date(m.startAt);
            return (
              <div key={m.id} className="cl-up" style={{ borderLeftColor: style(m).dot }}>
                <button type="button" className="cl-up__main" onClick={() => setModal({ meeting: m })}>
                  <div className="cl-up__title">{m.title}</div>
                  <div className="cl-up__sub">
                    {dayLabel(start)} · {range(m)} · {m.duration}{" "}{t("мин ·")}{" "}{m.attendees.length}{" "}{t("участн.")}</div>
                </button>
                {m.link ? (
                  <div className="cl-up__link">
                    {video && (
                      <span className="cl-video" style={{ background: video.color }}>
                        📹 {video.label}
                      </span>
                    )}
                    <span className="cl-up__url mono">{m.link}</span>
                    <button type="button" className={copiedId === m.id ? "is-copied" : ""} onClick={() => copy(m)}>
                      {copiedId === m.id ? t("✓ Скопировано") : t("⧉ Копировать")}
                    </button>
                    <a href={m.link} target="_blank" rel="noopener noreferrer">{t("Войти")}</a>
                  </div>
                ) : (
                  <span className="cl-up__novideo">{t("без видео")}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modal && <MeetModal meeting={modal.meeting} defaults={modal.defaults} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}

export default CallsPage;
