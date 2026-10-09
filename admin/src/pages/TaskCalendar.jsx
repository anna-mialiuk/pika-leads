import { useMemo, useState } from "react";

import { TasksHeader, useTaskModal, useTaskScope } from "../components/TasksShell";
import { localDay, useColumns } from "../lib/tasks";
import { todayIso } from "../lib/projects";
import { useMeta } from "../lib/meta";
import { t } from "../lib/i18n";

const MONTHS = [t("Январь"), t("Февраль"), t("Март"), t("Апрель"), t("Май"), t("Июнь"), t("Июль"), t("Август"), t("Сентябрь"), t("Октябрь"), t("Ноябрь"), t("Декабрь")];
const WEEK = [t("Пн"), t("Вт"), t("Ср"), t("Чт"), t("Пт"), t("Сб"), t("Вс")];
const pad = (n) => String(n).padStart(2, "0");

/** Календар дедлайнів (як у макеті): місяць сіткою, на телефоні — список днів */
function TaskCalendar() {
  const { scope, setScope, list } = useTaskScope();
  const { modal, openTask, openNew } = useTaskModal();
  const { userById } = useMeta();
  const { byKey: COLUMN_BY_KEY } = useColumns();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const today = todayIso();

  const byDay = useMemo(() => {
    const map = {};
    for (const t of list) (map[localDay(t.dueAt)] ||= []).push(t);
    Object.values(map).forEach((items) => items.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)));
    return map;
  }, [list]);

  const days = new Date(month.y, month.m + 1, 0).getDate();
  const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7; // понеділок — перший
  const total = Math.ceil((lead + days) / 7) * 7;
  const iso = (d) => `${month.y}-${pad(month.m + 1)}-${pad(d)}`;
  let monthCount = 0;
  for (let d = 1; d <= days; d++) monthCount += byDay[iso(d)]?.length || 0;

  const shift = (delta) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const color = (t) => COLUMN_BY_KEY[t.status]?.color || "#8a8f98";
  const agenda = [];
  for (let d = 1; d <= days; d++) if (byDay[iso(d)]?.length) agenda.push(d);

  return (
    <div className="tboard-page">
      <TasksHeader scope={scope} onScope={setScope} />

      <div className="tcal-head">
        <div className="tcal-nav">
          <button type="button" className="tcal-nav__btn" onClick={() => shift(-1)} aria-label={t("Предыдущий месяц")}>
            ‹
          </button>
          <div className="tcal-nav__label">
            {MONTHS[month.m]} {month.y}
          </div>
          <button type="button" className="tcal-nav__btn" onClick={() => shift(1)} aria-label={t("Следующий месяц")}>
            ›
          </button>
        </div>
        <div className="tcal-count">{t("Дедлайнов в месяце:")}{" "}<b>{monthCount}</b>
        </div>
      </div>

      <div className="tcal-grid-wrap">
        <div className="tcal-week">
          {WEEK.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="tcal-grid">
          {Array.from({ length: total }, (_, i) => {
            const day = i - lead + 1;
            if (day < 1 || day > days) return <div key={i} className="tcal-cell is-out" />;
            const key = iso(day);
            const items = byDay[key] || [];
            return (
              <div
                key={i}
                className={`tcal-cell ${key === today ? "is-today" : ""}`}
                onDoubleClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const due = new Date(month.y, month.m, day, 10, 0);
                  openNew({ due });
                }}
              >
                <div className="tcal-cell__head">
                  <div className="tcal-cell__day">{day}</div>
                  {items.length > 0 && <div className="tcal-cell__count">{items.length}</div>}
                </div>
                <div className="tcal-cell__items">
                  {items.slice(0, 3).map((t) => (
                    <button key={t.id} type="button" className="tcal-item" onClick={() => openTask(t)} title={t.title}>
                      <i style={{ background: color(t) }} />
                      <span>{t.title}</span>
                    </button>
                  ))}
                  {items.length > 3 && <div className="tcal-more">+{items.length - 3}{" "}{t("ещё")}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* телефон: тільки дні з дедлайнами */}
      <div className="tcal-agenda">
        {agenda.length === 0 && <div className="tcal-agenda__empty">{t("В этом месяце дедлайнов нет")}</div>}
        {agenda.map((day) => {
          const key = iso(day);
          return (
            <div key={day} className="tcal-agenda__day">
              <div className="tcal-agenda__date">
                <div className={key === today ? "is-today" : ""}>{day}</div>
                <span>{WEEK[(new Date(month.y, month.m, day).getDay() + 6) % 7]}</span>
              </div>
              <div className="tcal-agenda__items">
                {byDay[key].map((t) => (
                  <button key={t.id} type="button" className="tcal-agenda__item" onClick={() => openTask(t)}>
                    <i style={{ background: color(t) }} />
                    <div>
                      <div className="tcal-agenda__title">{t.title}</div>
                      <div className="tcal-agenda__sub">{userById[t.assigneeId]?.name || ""}</div>
                    </div>
                    <span>›</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="tboard-note">{t("Цвет точки — статус задачи. Двойной клик по дню — новая задача с дедлайном на этот день.")}</div>
      {modal}
    </div>
  );
}

export default TaskCalendar;
