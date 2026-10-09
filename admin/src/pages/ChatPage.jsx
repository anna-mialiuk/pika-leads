import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { TasksHeader } from "../components/TasksShell";
import { Modal } from "../components/ui";
import { api, fileIcon, fileUrl, formatSize, upload } from "../lib/api";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/projects";
import { useTasks } from "../lib/tasks";

import "../components/Projects.css";
import "./ChatPage.css";
import { t, tt } from "../lib/i18n";
import { ROLE_LABELS } from "../lib/roles";
import { ink } from "../lib/theme";

const AVATARS = ["#FFC629", "#5b9bff", "#f0883e", "#4fd88a", "#b98bff", "#4fd8c8", "#ff7d7d"];
const EMOJIS = ["😀", "😂", "🔥", "👍", "✅", "🎉", "💰", "📈", "🚀", "👀", "🙏", "💪", "❤️", "⚡", "🎯", "✍️"];
const QUICK = ["🔥", "👍", "✅"];
const VIDEO_LABEL = { googlemeet: "Google Meet", zoom: "Zoom", loom: "Loom" };

const avatarBg = (id) => AVATARS[(Number(id) || 0) % AVATARS.length];
const pad = (n) => String(n).padStart(2, "0");

function when(iso) {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - day) / 864e5);
  if (diff === 0) return tt("сегодня в {0}", time);
  if (diff === 1) return tt("вчера в {0}", time);
  return tt("{0}.{1}.{2} в {3}", pad(d.getDate()), pad(d.getMonth() + 1), d.getFullYear(), time);
}

/** Текст повідомлення: @згадки жовтим, посилання https:// клікабельні */
function MessageText({ text, names }) {
  if (!text) return null;
  const mentionRe = names.length ? names.map((n) => `@${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).join("|") : null;
  const re = new RegExp(`(https?:\\/\\/[^\\s<>"']+${mentionRe ? `|${mentionRe}` : ""})`, "g");
  return (
    <>
      {text.split(re).map((part, i) => {
        if (!part) return null;
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer">
              {part}
            </a>
          );
        }
        if (part.startsWith("@") && names.includes(part.slice(1))) return <b key={i} className="wc-mention">{part}</b>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function Attachment({ file }) {
  if (!file) return null;
  if (file.media === "image") {
    return (
      <a href={fileUrl(file.id)} download={file.name} className="wc-media" title={t("Скачать")}>
        <img src={`${fileUrl(file.id)}?inline=1`} alt={file.name} loading="lazy" />
      </a>
    );
  }
  if (file.media === "video") {
    return <video className="wc-media wc-media--video" src={`${fileUrl(file.id)}?inline=1`} controls preload="metadata" />;
  }
  return (
    <a href={fileUrl(file.id)} download={file.name} className="wc-doc">
      <span>{fileIcon(file.name)}</span>
      <div>
        <div className="wc-doc__name">{file.name}</div>
        <div className="wc-doc__size">{formatSize(file.size)}</div>
      </div>
    </a>
  );
}

function Toggle({ on, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`ts-switch ${on ? "is-on" : ""}`} disabled={disabled} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

/* ================= вікно каналу ================= */

function ChannelModal({ channel, icons, members, onClose, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    type: channel?.type || "text",
    name: channel?.name || "",
    topic: channel?.topic || "",
    icon: channel?.icon || "#",
    private: channel?.private || false,
    members: channel?.members?.length ? channel.members : [user.id],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const isProject = Boolean(channel?.projectId);

  const save = async () => {
    if (!form.name.trim()) return setError(t("Укажите название канала"));
    setBusy(true);
    setError("");
    try {
      const body = { ...form, name: form.name.trim() };
      if (isProject) {
        delete body.private;
        delete body.members;
      }
      const { channel: saved } = channel
        ? await api(`/chat/channels/${channel.id}`, { method: "PATCH", body })
        : await api("/chat/channels", { method: "POST", body });
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={channel ? t("Редактировать канал") : t("Создать канал")} onClose={onClose} className="task-modal proj-modal">
      <fieldset className="task-modal__body" disabled={busy}>
        <div className="tm-label">{t("Тип канала")}</div>
        <div className="wc-types">
          <button type="button" className={form.type === "text" ? "is-on" : ""} onClick={() => set({ type: "text", icon: form.icon === "🔊" ? "#" : form.icon })}>{t("# Текстовый")}</button>
          <button type="button" className={form.type === "voice" ? "is-on" : ""} onClick={() => set({ type: "voice", icon: form.icon === "#" ? "🔊" : form.icon })}>{t("🔊 Голосовой")}</button>
        </div>
        <div className="tm-label">{t("Название канала")}</div>
        <input className="tm-input tm-input--top pm-big" placeholder={t("напр. крео-гемблинг")} value={form.name} maxLength={40} autoFocus onChange={(e) => set({ name: e.target.value })} />
        <input className="tm-input tm-input--top" placeholder={t("Описание (необязательно)")} value={form.topic} maxLength={120} onChange={(e) => set({ topic: e.target.value })} />
        <div className="tm-label">{t("Иконка канала")}</div>
        <div className="pm-icons wc-icons">
          {icons.map((ic) => (
            <button key={ic} type="button" className={form.icon === ic ? "is-on" : ""} onClick={() => set({ icon: ic })}>
              {ic}
            </button>
          ))}
        </div>
        {isProject ? (
          <p className="wc-note">{t("Доступ к каналу проекта — у команды проекта (PM, байеры, участники) и администраторов.")}</p>
        ) : (
          <>
            <div className="wc-private">
              <div>
                <div className="wc-private__title">{t("🔒 Приватный канал")}</div>
                <div className="wc-private__desc">{t("Доступ только по приглашению")}</div>
              </div>
              <Toggle label={t("Приватный канал")} on={form.private} onChange={(v) => set({ private: v })} />
            </div>
            {form.private && (
              <>
                <div className="tm-label">{t("Участники")}</div>
                <div className="tm-chips">
                  {members.map((m) => {
                    const on = form.members.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`tm-chip ${on ? "is-on" : ""}`}
                        disabled={m.id === user.id}
                        onClick={() => set({ members: on ? form.members.filter((x) => x !== m.id) : [...form.members, m.id] })}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        {error && <div className="alert">⚠ {error}</div>}
        <div className="tm-actions">
          <button type="button" className="tm-save pm-save" onClick={save}>
            {busy ? t("Сохраняем…") : channel ? t("Сохранить") : t("Создать канал")}
          </button>
          <button type="button" className="tm-btn" onClick={onClose}>{t("Отмена")}</button>
        </div>
      </fieldset>
    </Modal>
  );
}

/* ================= сторінка ================= */

function ChatPage() {
  const { user } = useAuth();
  const { settings: taskSettings } = useTasks();
  const [params, setParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [activeId, setActiveId] = useState(() => Number(params.get("channel")) || null);
  const [messages, setMessages] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(() => Boolean(params.get("channel")));
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState([]);
  const [attach, setAttach] = useState(null); // File
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [modal, setModal] = useState(null); // {type:'channel', channel} | {type:'forward', message} | {type:'protect'}
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [openMsg, setOpenMsg] = useState(null); // на телефоні дії показуються по тапу
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const atBottom = useRef(true);
  const lastIdRef = useRef(0);
  const sinceRef = useRef("");
  const attachUrl = useMemo(() => (attach?.type?.startsWith("image/") ? URL.createObjectURL(attach) : null), [attach]);
  useEffect(() => () => attachUrl && URL.revokeObjectURL(attachUrl), [attachUrl]);

  const loadOverview = useCallback(
    () =>
      api("/chat")
        .then((data) => setOverview(data))
        .catch((e) => setError(e.message)),
    [],
  );

  useEffect(() => {
    loadOverview();
    const id = setInterval(() => document.visibilityState === "visible" && loadOverview(), 10_000);
    return () => clearInterval(id);
  }, [loadOverview]);

  // назви й описи стандартних каналів приходять російською — перекладаємо на мову панелі
  const channels = useMemo(() => (overview?.channels || []).map((c) => ({ ...c, name: t(c.name), topic: c.topic && t(c.topic).replace(/^Чат проекта · /, `${t("Чат проекта")} · `) })), [overview]);
  const active = channels.find((c) => c.id === activeId) || channels.find((c) => c.type === "text") || null;
  const members = useMemo(() => overview?.members || [], [overview]);
  const memberNames = useMemo(() => members.map((m) => m.name), [members]);

  // вибраний канал → в адресі (?channel=), щоб працювали посилання з Telegram
  const pick = (c) => {
    setActiveId(c.id);
    setMobileOpen(true);
    setShowPinned(false);
    setParams({ channel: String(c.id) }, { replace: true });
  };

  // повідомлення активного каналу: перше завантаження + опитування нових
  useEffect(() => {
    if (!active || active.type === "voice") {
      setMessages([]);
      setPinned([]);
      return undefined;
    }
    let cancelled = false;
    lastIdRef.current = 0;
    setMessages([]);
    atBottom.current = true;
    api(`/chat/channels/${active.id}/messages`)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setPinned(data.pinned);
        setHasMore(data.hasMore);
        lastIdRef.current = data.messages.at(-1)?.id || 0;
        sinceRef.current = data.serverTime;
      })
      .catch((e) => setError(e.message));
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api(`/chat/channels/${active.id}/messages?after=${lastIdRef.current}&since=${encodeURIComponent(sinceRef.current)}`)
        .then((data) => {
          if (cancelled) return;
          setPinned(data.pinned);
          sinceRef.current = data.serverTime;
          if (!data.messages.length && !data.changed.length) return;
          const changed = new Map(data.changed.map((m) => [m.id, m]));
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const updated = prev.filter((m) => !changed.get(m.id)?.deleted).map((m) => changed.get(m.id) || m);
            return [...updated, ...data.messages.filter((m) => !known.has(m.id))];
          });
          if (data.messages.length) lastIdRef.current = data.messages.at(-1).id;
        })
        .catch(() => {});
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active?.id, active?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // прокрутка вниз, якщо ми й так були внизу
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const loadOlder = async () => {
    if (!messages.length) return;
    const el = listRef.current;
    const prevHeight = el.scrollHeight;
    const data = await api(`/chat/channels/${active.id}/messages?before=${messages[0].id}`);
    setMessages((prev) => [...data.messages, ...prev]);
    setHasMore(data.hasMore);
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - prevHeight;
    });
  };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };

  const replaceMessage = (m) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
    setPinned((prev) => (m.pinned ? [...prev.filter((x) => x.id !== m.id), m] : prev.filter((x) => x.id !== m.id)));
  };

  const send = async () => {
    if (busy || !active) return;
    const value = text.trim();
    if (!value && !attach) return;
    setBusy(true);
    setError("");
    try {
      let fileId;
      if (attach) {
        const { file } = await upload(`/chat/channels/${active.id}/files`, attach);
        fileId = file.id;
      }
      const ids = [...new Set([...mentions, ...members.filter((m) => value.includes(`@${m.name}`)).map((m) => m.id)])];
      const { message } = await api(`/chat/channels/${active.id}/messages`, { method: "POST", body: { text: value, fileId, mentions: ids } });
      atBottom.current = true;
      setMessages((prev) => [...prev, message]);
      lastIdRef.current = Math.max(lastIdRef.current, message.id);
      setText("");
      setMentions([]);
      setAttach(null);
      setEmojiOpen(false);
      setMentionOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const react = (m, emoji) =>
    api(`/chat/channels/${active.id}/messages/${m.id}/react`, { method: "POST", body: { emoji } })
      .then(({ message }) => replaceMessage(message))
      .catch((e) => setError(e.message));

  const togglePin = (m) =>
    api(`/chat/channels/${active.id}/messages/${m.id}/pin`, { method: "POST" })
      .then(({ message }) => replaceMessage(message))
      .catch((e) => setError(e.message));

  const removeMessage = (m) => {
    if (!window.confirm(t("Удалить сообщение?"))) return;
    api(`/chat/channels/${active.id}/messages/${m.id}`, { method: "DELETE" })
      .then(() => {
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
        setPinned((prev) => prev.filter((x) => x.id !== m.id));
      })
      .catch((e) => setError(e.message));
  };

  const copy = (m) => {
    if (active.protect.noForward) return flash(t("В этом канале запрещено копирование"));
    navigator.clipboard?.writeText(m.text || m.file?.name || "").then(() => flash(t("Скопировано")));
    return null;
  };

  const forward = async (target) => {
    try {
      await api(`/chat/channels/${target.id}/messages`, {
        method: "POST",
        body: { forward: { channelId: active.id, messageId: modal.message.id } },
      });
      setModal(null);
      flash(tt("Переслано в #{0}", target.name));
      loadOverview();
    } catch (e) {
      setError(e.message);
    }
  };

  const addMention = (m) => {
    const next = `${text.replace(/\s*$/, "")}${text.trim() ? " " : ""}@${m.name} `;
    setText(next);
    setMentions((prev) => (prev.includes(m.id) ? prev : [...prev, m.id]));
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const saveProtect = (patch) =>
    api(`/chat/channels/${active.id}`, { method: "PATCH", body: { protect: { ...active.protect, ...patch } } })
      .then(loadOverview)
      .catch((e) => setError(e.message));

  const deleteChannel = async (c) => {
    try {
      if (user.role === "admin") {
        if (!window.confirm(tt("Удалить канал #{0} вместе с историей?", c.name))) return;
        await api(`/chat/channels/${c.id}`, { method: "DELETE" });
        if (c.id === active?.id) setActiveId(null);
      } else {
        if (!window.confirm(tt("Отправить администратору заявку на удаление #{0}?", c.name))) return;
        await api(`/chat/channels/${c.id}/delete-request`, { method: "POST" });
        flash(t("Заявка отправлена администратору"));
      }
      loadOverview();
    } catch (e) {
      setError(e.message);
    }
  };

  const voice = async (join) => {
    try {
      await api(`/chat/channels/${active.id}/voice`, { method: "POST", body: { join } });
      loadOverview();
    } catch (e) {
      setError(e.message);
    }
  };

  const groups = [
    { label: t("Текстовые каналы"), items: channels.filter((c) => c.type === "text" && !c.projectId) },
    { label: t("Каналы проектов"), items: channels.filter((c) => c.projectId) },
    { label: t("Голосовые каналы"), items: channels.filter((c) => c.type === "voice" && !c.projectId) },
  ].filter((g) => g.items.length);
  const delReqs = channels.filter((c) => c.deleteRequest);
  const online = members.filter((m) => m.online);
  const offline = members.filter((m) => !m.online);
  const room = taskSettings?.settings.video?.googlemeet?.link
    ? { link: taskSettings.settings.video.googlemeet.link, label: VIDEO_LABEL.googlemeet }
    : taskSettings?.settings.video?.zoom?.link
      ? { link: taskSettings.settings.video.zoom.link, label: VIDEO_LABEL.zoom }
      : null;
  const me = members.find((m) => m.id === user.id);

  if (!overview) {
    return (
      <div className="tboard-page">
        <TasksHeader />
        {error ? (
          <div className="alert">⚠ {error}</div>
        ) : (
          <div className="content-loading">
            <div className="spinner" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tboard-page">
      <TasksHeader />
      {error && (
        <div className="alert" role="alert">
          ⚠ {error}{" "}
          <button type="button" className="wc-x" onClick={() => setError("")} aria-label={t("Скрыть")}>
            ✕
          </button>
        </div>
      )}

      <div className="wc" data-mobileopen={mobileOpen && active ? "true" : "false"}>
        {/* канали */}
        <aside className="wc-channels">
          <div className="wc-channels__head">
            PIKALEADS
            <button type="button" title={t("Создать канал")} onClick={() => setModal({ type: "channel" })}>
              +
            </button>
          </div>
          <div className="wc-channels__list">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="wc-group">{g.label}</div>
                {g.items.map((c) => (
                  <div
                    key={c.id}
                    className={`wc-chan ${active?.id === c.id ? "is-active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => pick(c)}
                    onKeyDown={(e) => e.key === "Enter" && pick(c)}
                  >
                    <span className="wc-chan__icon">{c.icon}</span>
                    <span className="wc-chan__name">{c.name}</span>
                    {c.private && !c.projectId && <span className="wc-chan__lock">🔒</span>}
                    {c.deleteRequest && <span className="wc-chan__pending">{t("на удаление")}</span>}
                    {c.unread > 0 && active?.id !== c.id && <span className="wc-chan__unread">{c.unread > 99 ? "99+" : c.unread}</span>}
                    {(c.canModerate || user.role === "admin") && (
                      <span className="wc-chan__actions">
                        <button
                          type="button"
                          title={t("Редактировать канал")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setModal({ type: "channel", channel: c });
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          title={user.role === "admin" ? t("Удалить канал") : t("Запросить удаление у админа")}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChannel(c);
                          }}
                        >
                          {user.role === "admin" ? "✕" : "⌦"}
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <button type="button" className="wc-newchan" onClick={() => setModal({ type: "channel" })}>{t("+ Создать канал")}</button>
          </div>
          {delReqs.length > 0 && (
            <div className="wc-delreq">
              <button type="button" className="wc-delreq__head" onClick={() => setDelOpen(!delOpen)}>
                <span>⌦</span>
                <b>{t("Заявки на удаление ·")}{" "}{delReqs.length}</b>
                <span>▾</span>
              </button>
              {delOpen &&
                delReqs.map((c) => (
                  <div key={c.id} className="wc-delreq__item">
                    <b>#{c.name}</b>
                    <small>
                      {c.deleteRequest.name} · {when(c.deleteRequest.at)}
                    </small>
                    {user.role === "admin" ? (
                      <div className="wc-delreq__btns">
                        <button
                          type="button"
                          className="is-danger"
                          onClick={async () => {
                            await api(`/chat/channels/${c.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
                            loadOverview();
                          }}
                        >{t("Удалить")}</button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api(`/chat/channels/${c.id}/delete-request`, { method: "DELETE" }).catch((e) => setError(e.message));
                            loadOverview();
                          }}
                        >{t("Отклонить")}</button>
                      </div>
                    ) : (
                      c.deleteRequest.userId === user.id && (
                        <button
                          type="button"
                          className="wc-delreq__cancel"
                          onClick={async () => {
                            await api(`/chat/channels/${c.id}/delete-request`, { method: "DELETE" }).catch((e) => setError(e.message));
                            loadOverview();
                          }}
                        >{t("Отменить заявку")}</button>
                      )
                    )}
                  </div>
                ))}
            </div>
          )}
          <div className="wc-me">
            <div className="wc-avatar" style={{ background: avatarBg(user.id) }}>
              {initials(user.name)}
            </div>
            <div>
              <div className="wc-me__name">{user.name}</div>
              <div className="wc-me__status">● {me?.position ? t(me.position) : ROLE_LABELS[user.role]}</div>
            </div>
          </div>
        </aside>

        {/* повідомлення */}
        <section className="wc-main">
          {active ? (
            <>
              <div className="wc-head">
                <button type="button" className="wc-back" onClick={() => setMobileOpen(false)} aria-label={t("К каналам")}>
                  ‹
                </button>
                <span className="wc-head__icon">{active.icon}</span>
                <span className="wc-head__name">{active.name}</span>
                {active.private && <span className="wc-head__priv">{t("🔒 Приватный")}</span>}
                <span className="wc-head__topic">{active.topic}</span>
                {pinned.length > 0 && (
                  <button type="button" className="wc-head__btn wc-head__pins" title={t("Закреплённые")} onClick={() => setShowPinned(!showPinned)}>
                    📌 {pinned.length}
                  </button>
                )}
                {active.type !== "voice" && (
                  <button type="button" className="wc-head__btn" title={t("Защита и настройки канала")} onClick={() => setModal({ type: "protect" })}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" />
                    </svg>
                  </button>
                )}
              </div>

              {showPinned && (
                <div className="wc-pins">
                  <div className="wc-pins__title">{t("ЗАКРЕПЛЁННЫЕ СООБЩЕНИЯ")}</div>
                  {pinned.map((p) => (
                    <div key={p.id} className="wc-pin">
                      <span>📌</span>
                      <div>
                        <b>{p.name}</b>
                        <small>{when(p.at)}</small>
                        <div>{p.text || p.file?.name}</div>
                      </div>
                      <button type="button" onClick={() => togglePin(p)}>{t("открепить")}</button>
                    </div>
                  ))}
                </div>
              )}

              {active.type === "voice" ? (
                <div className="wc-voice">
                  <div className="wc-voice__icon">🔊</div>
                  <div className="wc-voice__title">{active.name}</div>
                  <div className="wc-voice__sub">{active.topic || t("Голосовой канал команды")}</div>
                  {active.voice.length > 0 && (
                    <div className="wc-voice__people">
                      {active.voice.map((v) => (
                        <span key={v.userId}>
                          <i style={{ background: avatarBg(v.userId) }}>{initials(v.name)}</i>
                          {v.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {room ? (
                    <div className="wc-voice__btns">
                      <a href={room.link} target="_blank" rel="noopener noreferrer" className="wc-voice__join" onClick={() => voice(true)}>{t("Войти в звонок ·")}{" "}{room.label}
                      </a>
                      {active.voice.some((v) => v.userId === user.id) && (
                        <button type="button" className="tm-btn" onClick={() => voice(false)}>{t("Выйти")}</button>
                      )}
                    </div>
                  ) : (
                    <p className="wc-note">{t("Подключите комнату Google Meet или Zoom в «Задачи → Настройки → Видеозвонки» — здесь появится кнопка входа в звонок.")}</p>
                  )}
                </div>
              ) : (
                <div
                  ref={listRef}
                  className="wc-list"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  }}
                >
                  {hasMore && (
                    <button type="button" className="wc-older" onClick={loadOlder}>{t("Показать более ранние")}</button>
                  )}
                  {messages.length === 0 && <div className="wc-empty">{t("Сообщений пока нет — напишите первым 👋")}</div>}
                  {messages.map((m) => {
                    const mine = m.userId === user.id;
                    const reacts = Object.entries(m.reactions || {});
                    return (
                      <div
                        key={m.id}
                        className={`wc-msg ${openMsg === m.id ? "is-open" : ""}`}
                        onClick={(e) => {
                          if (e.target.closest("a, button, video")) return;
                          setOpenMsg(openMsg === m.id ? null : m.id);
                        }}
                      >
                        <div className="wc-avatar wc-avatar--lg" style={{ background: avatarBg(m.userId) }}>
                          {initials(m.name)}
                        </div>
                        <div className="wc-msg__body">
                          <div className="wc-msg__head">
                            <b style={{ color: ink(avatarBg(m.userId)) }}>{m.name}</b>
                            <small>{when(m.at)}</small>
                            {m.pinned && <span className="wc-msg__pinned">{t("📌 закреплено")}</span>}
                          </div>
                          {m.fwd && (
                            <div className="wc-msg__fwd">{t("↪ переслано от")}{" "}{m.fwd.name}{" "}{t("из #")}{m.fwd.channel}
                            </div>
                          )}
                          {m.text && (
                            <div className="wc-msg__text">
                              <MessageText text={m.text} names={memberNames} />
                            </div>
                          )}
                          <Attachment file={m.file} />
                          {reacts.length > 0 && (
                            <div className="wc-reacts">
                              {reacts.map(([emoji, ids]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className={ids.includes(user.id) ? "is-mine" : ""}
                                  title={ids.map((id) => members.find((x) => x.id === id)?.name).filter(Boolean).join(", ")}
                                  onClick={() => react(m, emoji)}
                                >
                                  {emoji} {ids.length}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="wc-msg__actions">
                          {QUICK.map((emoji) => (
                            <button key={emoji} type="button" title={t("Реакция")} onClick={() => react(m, emoji)}>
                              {emoji}
                            </button>
                          ))}
                          {!active.protect.noForward && (
                            <button type="button" title={t("Переслать")} onClick={() => setModal({ type: "forward", message: m })}>
                              ↪
                            </button>
                          )}
                          <button type="button" title={m.pinned ? t("Открепить") : t("Закрепить")} onClick={() => togglePin(m)}>
                            {m.pinned ? "📌" : "📍"}
                          </button>
                          {!active.protect.noForward && (
                            <button type="button" title={t("Копировать")} onClick={() => copy(m)}>
                              ⧉
                            </button>
                          )}
                          {(mine || active.canModerate) && (
                            <button type="button" title={t("Удалить")} className="is-del" onClick={() => removeMessage(m)}>
                              🗑
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {active.type !== "voice" && attach && (
                <div className="wc-attach">
                  <div>
                    {attachUrl ? <img src={attachUrl} alt="" /> : <span>{fileIcon(attach.name)}</span>}
                    <div>
                      <b>{attach.name}</b>
                      <small>{formatSize(attach.size)}</small>
                    </div>
                    <button type="button" onClick={() => setAttach(null)} aria-label={t("Убрать файл")}>
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {active.type !== "voice" &&
                (active.canWrite ? (
                  <div className="wc-compose">
                    <label className="wc-btn wc-hide-mobile" title={t("Фото или видео")}>
                      🖼
                      <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime" hidden onChange={(e) => {
                        setAttach(e.target.files[0] || null);
                        e.target.value = "";
                      }} />
                    </label>
                    <label className="wc-btn" title={t("Документ")}>
                      📎
                      <input type="file" hidden onChange={(e) => {
                        setAttach(e.target.files[0] || null);
                        e.target.value = "";
                      }} />
                    </label>
                    <input
                      ref={inputRef}
                      className="wc-input"
                      value={text}
                      placeholder={tt("Сообщение в #{0}… (@ — упомянуть)", active.name)}
                      maxLength={4000}
                      onChange={(e) => {
                        setText(e.target.value);
                        if (e.target.value.endsWith("@")) setMentionOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                        if (e.key === "Escape") {
                          setMentionOpen(false);
                          setEmojiOpen(false);
                        }
                      }}
                      onPaste={(e) => {
                        const file = [...(e.clipboardData?.files || [])][0];
                        if (file) {
                          e.preventDefault();
                          setAttach(file);
                        }
                      }}
                    />
                    <button type="button" className="wc-btn wc-btn--at wc-hide-mobile" title={t("Упомянуть")} onClick={() => setMentionOpen(!mentionOpen)}>
                      @
                    </button>
                    <button type="button" className="wc-btn" title={t("Эмодзи")} onClick={() => setEmojiOpen(!emojiOpen)}>
                      😊
                    </button>
                    <button type="button" className="wc-send" title={t("Отправить")} onClick={send} disabled={busy}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2 11 13" />
                        <path d="M22 2 15 22l-4-9-9-4 20-7z" />
                      </svg>
                    </button>
                    {emojiOpen && (
                      <div className="wc-pop wc-pop--emoji">
                        {EMOJIS.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => {
                              setText((t) => t + ch);
                              inputRef.current?.focus();
                            }}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    )}
                    {mentionOpen && (
                      <div className="wc-pop wc-pop--mention">
                        <div className="wc-pop__title">{t("УПОМЯНУТЬ")}</div>
                        {members
                          .filter((m) => m.id !== user.id)
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                if (text.endsWith("@")) setText(text.slice(0, -1));
                                addMention(m);
                              }}
                            >
                              <i style={{ background: avatarBg(m.id) }}>{initials(m.name)}</i>
                              {m.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="wc-readonly">{t("🔒 В этом канале пишут только модераторы")}</div>
                ))}
            </>
          ) : (
            <div className="wc-empty wc-empty--page">{t("Создайте первый канал — кнопка «+» слева.")}</div>
          )}
        </section>

        {/* учасники */}
        <aside className="wc-members">
          {[
            { label: t("В сети"), list: online },
            { label: t("Не в сети"), list: offline },
          ].map((g) =>
            g.list.length ? (
              <div key={g.label}>
                <div className="wc-group">
                  {g.label} — {g.list.length}
                </div>
                {g.list.map((m) => (
                  <div key={m.id} className={`wc-member ${m.online ? "" : "is-off"}`}>
                    <div className="wc-member__av">
                      <div className="wc-avatar" style={{ background: avatarBg(m.id) }}>
                        {initials(m.name)}
                      </div>
                      <i style={{ background: m.online ? "#4fd88a" : "#6b7075" }} />
                    </div>
                    <div>
                      <div className="wc-member__name">{m.name}</div>
                      <div className="wc-member__role">{m.position ? t(m.position) : ROLE_LABELS[m.role]}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null,
          )}
        </aside>
      </div>

      {toast && <div className="wc-toast">{toast}</div>}

      {modal?.type === "channel" && (
        <ChannelModal
          channel={modal.channel}
          icons={overview.icons}
          members={members}
          onClose={() => setModal(null)}
          onSaved={(c) => {
            loadOverview();
            if (!modal.channel) pick(c);
          }}
        />
      )}

      {modal?.type === "forward" && (
        <Modal title={t("Переслать сообщение")} onClose={() => setModal(null)} className="task-modal proj-modal">
          <div className="wc-fwd-preview">{modal.message.text || modal.message.file?.name}</div>
          <div className="tm-label">{t("Выберите канал")}</div>
          <div className="wc-fwd-list">
            {channels
              .filter((c) => c.type === "text" && c.id !== active.id && c.canWrite)
              .map((c) => (
                <button key={c.id} type="button" onClick={() => forward(c)}>
                  <span>{c.icon}</span>
                  {c.name}
                </button>
              ))}
          </div>
          <button type="button" className="tm-btn wc-fwd-cancel" onClick={() => setModal(null)}>{t("Отмена")}</button>
        </Modal>
      )}

      {modal?.type === "protect" && active && (
        <Modal title={t("Защита канала")} onClose={() => setModal(null)} className="task-modal proj-modal">
          <p className="wc-note">{t("Канал «")}{active.name}»</p>
          <div className="wc-protect">
            {[
              { key: "onlyMods", label: t("Пишут только модераторы"), desc: t("Остальные — только чтение") },
              { key: "noForward", label: t("Запрет пересылки"), desc: t("Нельзя пересылать и копировать") },
              { key: "slowmode", label: t("Медленный режим"), desc: t("1 сообщение в 30 секунд") },
            ].map((r) => (
              <div key={r.key} className="wc-private">
                <div>
                  <div className="wc-private__title">{r.label}</div>
                  <div className="wc-private__desc">{r.desc}</div>
                </div>
                <Toggle label={r.label} on={active.protect[r.key]} disabled={!active.canModerate} onChange={(v) => saveProtect({ [r.key]: v })} />
              </div>
            ))}
          </div>
          {!active.canModerate && <p className="wc-note">{t("Менять защиту может администратор или автор канала.")}</p>}
          <p className="wc-note">{t("Сообщения хранятся на сервере панели и видны только участникам канала (для приватных — по приглашению).")}</p>
          <button type="button" className="tm-save pm-save wc-done" onClick={() => setModal(null)}>{t("Готово")}</button>
        </Modal>
      )}
    </div>
  );
}

export default ChatPage;
