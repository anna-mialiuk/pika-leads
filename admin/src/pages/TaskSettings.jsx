import { useState } from "react";

import Icon from "../components/Icon";
import { TasksHeader } from "../components/TasksShell";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTasks } from "../lib/tasks";

import "./TaskSettings.css";

const SWATCHES = ["#8a8f98", "#5b9bff", "#FFC629", "#f0883e", "#4fd88a", "#ff7d7d", "#b98bff", "#4fd8c8"];
const REQUIRED = { todo: "в неё попадают новые задачи", done: "её ставит кнопка «✅ Готово» в Telegram" };

const VIDEO = [
  { key: "zoom", label: "Zoom", mark: "Z", markBg: "#2D8CFF", desc: "Ссылка на постоянную комнату Zoom подставляется в звонки и планёрки", placeholder: "https://us02web.zoom.us/j/…" },
  { key: "googlemeet", label: "Google Meet", mark: "M", markBg: "#00AC47", desc: "Ссылка на Meet подставляется при создании звонка", placeholder: "https://meet.google.com/abc-defg-hij" },
  { key: "loom", label: "Loom", mark: "L", markBg: "#625DF5", desc: "Асинхронные видео-записи: ссылка на ваше пространство Loom", placeholder: "https://www.loom.com/…" },
];

const NOTIFY = [
  { key: "assign", label: "Назначение задачи", desc: "Исполнитель получает уведомление, когда на него ставят задачу" },
  { key: "deadline", label: "Приближение дедлайна", desc: "Напоминание за день до срока" },
  { key: "overdue", label: "Наступление дедлайна", desc: "Напоминание в момент дедлайна с кнопками «✅ Готово» и «⏰ +1 час»" },
  { key: "comment", label: "Комментарии", desc: "Уведомление о новом комментарии в задаче (отмеченные через @ получают всегда)" },
];

function Switch({ on, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`ts-switch ${on ? "is-on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

const TelegramMark = () => (
  <div className="ts-tg">
    <Icon name="telegram" size={20} />
  </div>
);

/** Налаштування задач (як у макеті): колонки, Telegram, відеозв'язок, сповіщення */
function TaskSettings() {
  const { user } = useAuth();
  const { settings: data, setSettings, setColumns, tasks, reload } = useTasks();
  const isAdmin = user.role === "admin";
  const [draft, setDraft] = useState(null); // колонки, що редагуються
  const [rooms, setRooms] = useState({}); // відкриті поля «посилання на кімнату»
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!data) {
    return (
      <div className="tboard-page">
        <TasksHeader />
        <div className="content-loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }
  const settings = data.settings;
  const columns = draft || settings.columns;
  const dirty = draft !== null;

  const save = async (body, message = "") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/tasks/settings", { method: "PUT", body });
      setSettings({ settings: result.settings, bot: result.bot });
      setColumns(result.settings.columns);
      if (result.moved) {
        reload();
        setNotice(`Сохранено. Задачи из удалённых колонок (${result.moved}) перенесены в «${result.settings.columns[0].label}».`);
      } else if (message) setNotice(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const editCol = (index, patch) => setDraft(columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const move = (index, delta) => {
    const next = [...columns];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };
  const removeCol = (index) => {
    const col = columns[index];
    const count = tasks.filter((t) => t.status === col.key).length;
    if (count && !window.confirm(`В колонке «${col.label}» ${count} задач — они перейдут в «${columns.find((c) => c.key === "todo")?.label}». Удалить?`)) return;
    setDraft(columns.filter((_, i) => i !== index));
  };
  const addCol = () => setDraft([...columns.slice(0, -2), { label: "Новый статус", color: "#4fd8c8" }, ...columns.slice(-2)]);

  const saveColumns = async () => {
    if (await save({ columns: draft }, "Колонки сохранены — доска уже обновилась.")) setDraft(null);
  };

  const notify = settings.notify;
  const bot = data.bot;

  return (
    <div className="tboard-page">
      <TasksHeader />
      <div className="ts">
        {!isAdmin && <div className="ts-readonly">Изменять настройки может администратор.</div>}
        {error && <div className="alert">⚠ {error}</div>}
        {notice && <div className="alert alert--ok">✓ {notice}</div>}

        {/* колонки */}
        <section className="ts-card">
          <div className="ts-card__head">
            <div className="ts-card__title">Статусы задач (колонки)</div>
            {isAdmin && (
              <button type="button" className="ts-yellow" onClick={addCol} disabled={columns.length >= 12}>
                + Добавить статус
              </button>
            )}
          </div>
          <div className="ts-card__text">Переименуйте колонки канбана, назначьте цвета и порядок.</div>
          <div className="ts-cols">
            {columns.map((c, i) => (
              <div key={c.key || `new${i}`} className="ts-col">
                <div className="ts-col__arrows">
                  <button type="button" disabled={!isAdmin || i === 0} onClick={() => move(i, -1)} aria-label="Выше">
                    ▲
                  </button>
                  <button type="button" disabled={!isAdmin || i === columns.length - 1} onClick={() => move(i, 1)} aria-label="Ниже">
                    ▼
                  </button>
                </div>
                <div className="ts-col__color" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
                <input
                  className="ts-col__label"
                  value={c.label}
                  maxLength={40}
                  disabled={!isAdmin}
                  onChange={(e) => editCol(i, { label: e.target.value })}
                  aria-label="Название колонки"
                />
                {c.closed && <span className="ts-col__closed">закрытая</span>}
                <div className="ts-col__swatches">
                  {SWATCHES.map((col) => (
                    <button
                      key={col}
                      type="button"
                      disabled={!isAdmin}
                      aria-label={`Цвет ${col}`}
                      style={{ background: col, boxShadow: col === c.color ? `0 0 0 2px var(--surface), 0 0 0 4px ${col}` : "none" }}
                      onClick={() => editCol(i, { color: col })}
                    />
                  ))}
                </div>
                {isAdmin && columns.length > 2 && !REQUIRED[c.key] && (
                  <button type="button" className="ts-col__del" title="Удалить" aria-label="Удалить колонку" onClick={() => removeCol(i)}>
                    ×
                  </button>
                )}
                {REQUIRED[c.key] && <span className="ts-col__lock" title={`Нельзя удалить: ${REQUIRED[c.key]}`}>🔒</span>}
              </div>
            ))}
          </div>
          {dirty && (
            <div className="ts-save-row">
              <button type="button" className="ts-yellow" onClick={saveColumns} disabled={busy}>
                {busy ? "Сохраняем…" : "Сохранить колонки"}
              </button>
              <button type="button" className="tm-btn" onClick={() => setDraft(null)}>
                Отменить
              </button>
            </div>
          )}
        </section>

        {/* Telegram: /task */}
        <section className="ts-card">
          <div className="ts-card__title">Постановка задач через Telegram</div>
          <div className="ts-card__text">Бот задаёт вопросы по задаче в чате и создаёт её в системе автоматически.</div>
          <div className="ts-row ts-row--box">
            <div className="ts-row__info">
              <TelegramMark />
              <div>
                <div className="ts-row__title">Создание задач из Telegram</div>
                <div className="ts-row__desc">Команда /task запускает пошаговую форму</div>
              </div>
            </div>
            <Switch
              label="Создание задач из Telegram"
              on={settings.telegramCreate}
              disabled={!isAdmin || busy}
              onChange={(v) => save({ telegramCreate: v })}
            />
          </div>
          <div className="ts-chat">
            <div className="ts-chat__label">Пример диалога бота</div>
            <div className="ts-chat__list">
              <div className="ts-bubble">🤖 Введите название задачи</div>
              <div className="ts-bubble is-me">Настроить ретаргет для клиники</div>
              <div className="ts-bubble">🤖 Дедлайн? · Проект? · Ответственный? — выбор кнопками</div>
              <div className="ts-bubble is-me">Завтра 10:00 · Клиника · Олег</div>
              <div className="ts-bubble">✅ Задача создана в колонке «{settings.columns.find((c) => c.key === "todo")?.label}»</div>
            </div>
          </div>
          <div className="ts-bot">
            {bot?.configured ? (
              <>
                Бот:{" "}
                {bot.username ? (
                  <a href={`https://t.me/${bot.username}`} target="_blank" rel="noopener noreferrer">
                    @{bot.username}
                  </a>
                ) : (
                  "подключён"
                )}{" "}
                · чтобы бот узнал сотрудника, тот подключает Telegram в своём профиле панели, затем пишет боту <code>/task</code>.
              </>
            ) : (
              <>Telegram-бот не настроен на сервере (TELEGRAM_BOT_TOKEN).</>
            )}
          </div>
        </section>

        {/* відеозв'язок */}
        <section className="ts-card">
          <div className="ts-card__title">Видеозвонки и конференции</div>
          <div className="ts-card__text">
            Сохраните ссылку на постоянную комнату — при создании звонка в разделе «Звонки» она подставится автоматически.
          </div>
          <div className="ts-video">
            {VIDEO.map((v) => {
              const link = settings.video?.[v.key]?.link || "";
              const on = Boolean(link);
              const editing = rooms[v.key] !== undefined;
              return (
                <div key={v.key} className={`ts-vcard ${on ? "is-on" : ""}`}>
                  <div className="ts-vcard__head">
                    <div className="ts-vcard__mark" style={{ background: v.markBg }}>
                      {v.mark}
                    </div>
                    <div>
                      <div className="ts-vcard__label">{v.label}</div>
                      <div className="ts-vcard__status">● {on ? "Подключён" : "Не подключён"}</div>
                    </div>
                  </div>
                  <div className="ts-vcard__desc">{on && !editing ? <span className="mono">{link}</span> : v.desc}</div>
                  {editing ? (
                    <>
                      <input
                        className="tm-input mono ts-vcard__input"
                        value={rooms[v.key]}
                        placeholder={v.placeholder}
                        autoFocus
                        onChange={(e) => setRooms({ ...rooms, [v.key]: e.target.value })}
                      />
                      <div className="ts-vcard__btns">
                        <button
                          type="button"
                          className="ts-yellow"
                          disabled={busy}
                          onClick={async () => {
                            if (await save({ video: { [v.key]: { link: rooms[v.key].trim() } } }, `${v.label} подключён.`)) {
                              const next = { ...rooms };
                              delete next[v.key];
                              setRooms(next);
                            }
                          }}
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="tm-btn"
                          onClick={() => {
                            const next = { ...rooms };
                            delete next[v.key];
                            setRooms(next);
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    </>
                  ) : (
                    isAdmin && (
                      <button
                        type="button"
                        className={on ? "ts-vcard__off" : "ts-yellow ts-vcard__on"}
                        disabled={busy}
                        onClick={() =>
                          on
                            ? window.confirm(`Отключить ${v.label}?`) && save({ video: { [v.key]: { link: "" } } })
                            : setRooms({ ...rooms, [v.key]: "" })
                        }
                      >
                        {on ? "Отключить" : "Подключить"}
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
          <div className="ts-row ts-row--box">
            <div>
              <div className="ts-row__title">Автоссылка на встречу</div>
              <div className="ts-row__desc">Подставлять ссылку подключённого сервиса при создании звонка</div>
            </div>
            <Switch label="Автоссылка на встречу" on={settings.autoLink} disabled={!isAdmin || busy} onChange={(v) => save({ autoLink: v })} />
          </div>
        </section>

        {/* сповіщення */}
        <section className="ts-card">
          <div className="ts-card__title">Уведомления о задачах</div>
          <div className="ts-card__text">Бот присылает сотруднику оповещения о его задачах в Telegram.</div>
          <div className="ts-row ts-row--box">
            <div className="ts-row__info">
              <TelegramMark />
              <div>
                <div className="ts-row__title">Оповещения в Telegram</div>
                <div className="ts-row__desc">Личные уведомления каждому сотруднику</div>
              </div>
            </div>
            <Switch
              label="Оповещения в Telegram"
              on={notify.enabled}
              disabled={!isAdmin || busy}
              onChange={(v) => save({ notify: { enabled: v } })}
            />
          </div>
          <div className={`ts-notify ${notify.enabled ? "" : "is-off"}`}>
            {NOTIFY.map((n) => (
              <div key={n.key} className="ts-row">
                <div>
                  <div className="ts-row__title">{n.label}</div>
                  <div className="ts-row__desc">{n.desc}</div>
                </div>
                <Switch
                  label={n.label}
                  on={notify[n.key]}
                  disabled={!isAdmin || busy || !notify.enabled}
                  onChange={(v) => save({ notify: { [n.key]: v } })}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default TaskSettings;
