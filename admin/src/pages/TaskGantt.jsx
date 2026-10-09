import { useEffect, useMemo, useRef, useState } from "react";

import { TasksHeader, useTaskModal, useTaskScope } from "../components/TasksShell";
import { isOverdue, localDay, useColumns } from "../lib/tasks";
import { useMeta } from "../lib/meta";
import { useProjects } from "../lib/projects";
import { t } from "../lib/i18n";

const COL = 40; // px на день
const DAY = 864e5;
const WEEKDAYS = [t("Вс"), t("Пн"), t("Вт"), t("Ср"), t("Чт"), t("Пт"), t("Сб")];
const MONTHS = [t("янв"), t("фев"), t("мар"), t("апр"), t("май"), t("июн"), t("июл"), t("авг"), t("сен"), t("окт"), t("ноя"), t("дек")];
const PRI_DOT = { high: "#ff7d7d", medium: "#f0883e", low: "#5b9bff" };

const parse = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const idx = (date, base) => Math.round((date - base) / DAY);
const short = (date) => `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Діаграма Ганта (як у макеті): смуга — від старту до дедлайну, колір — статус, точка — пріоритет */
function TaskGantt() {
  const { scope, setScope, list } = useTaskScope();
  const { modal, openTask } = useTaskModal();
  const { userById } = useMeta();
  const { byId: projectById } = useProjects();
  const { columns, byKey: COLUMN_BY_KEY } = useColumns();
  const LEGEND = ["todo", "inprogress", "review", "done"].filter((k) => COLUMN_BY_KEY[k]);
  if (LEGEND.length < 2) LEGEND.splice(0, LEGEND.length, ...columns.slice(0, 4).map((c) => c.key));
  const scrollRef = useRef(null);
  const [now] = useState(() => Date.now());

  const data = useMemo(() => {
    const rows = list
      .filter((t) => !t.done || new Date(t.doneAt || t.dueAt) > now - 30 * DAY)
      .map((t) => {
        const end = parse(localDay(t.dueAt));
        let start = t.startAt ? parse(t.startAt) : end;
        if (start > end) start = end;
        return { t, start, end };
      });
    if (!rows.length) return null;

    let min = rows[0].start;
    let max = rows[0].end;
    rows.forEach((r) => {
      if (r.start < min) min = r.start;
      if (r.end > max) max = r.end;
    });
    const today = parse(localDay(new Date(now).toISOString()));
    if (today < min) min = today;
    if (today > max) max = today;
    min = new Date(min.getFullYear(), min.getMonth(), min.getDate() - 2);
    max = new Date(max.getFullYear(), max.getMonth(), max.getDate() + 3);
    let total = idx(max, min) + 1;
    if (total < 40) total = 40;

    const days = Array.from({ length: total }, (_, i) => {
      const d = new Date(min.getFullYear(), min.getMonth(), min.getDate() + i);
      const wd = d.getDay();
      return { i, d, wd, weekend: wd === 0 || wd === 6, isToday: idx(d, today) === 0, showMon: i === 0 || d.getDate() === 1 };
    });

    const groups = new Map();
    rows
      .sort((a, b) => a.start - b.start)
      .forEach((r) => {
        const p = r.t.projectId ? projectById[r.t.projectId] : null;
        const key = p ? p.id : 0;
        if (!groups.has(key)) groups.set(key, { key, name: p ? p.name : t("Без проекта"), color: p ? p.color : "#8a8f98", rows: [] });
        const si = idx(r.start, min);
        const ei = idx(r.end, min);
        const length = ei - si + 1;
        groups.get(key).rows.push({
          ...r,
          left: si * COL,
          width: Math.max(COL - 6, length * COL - 6),
          mLeft: `${(si / total) * 100}%`,
          mWidth: `${Math.max(4, (length / total) * 100)}%`,
          label: `${short(r.start)}–${short(r.end)}`,
          inside: length >= 3,
          color: COLUMN_BY_KEY[r.t.status]?.color || "#8a8f98",
        });
      });
    // проекти — першими, «Без проекта» — в кінці
    const sorted = [...groups.values()].sort((a, b) => (a.key === 0) - (b.key === 0) || a.name.localeCompare(b.name, "ru"));
    return { days, groups: sorted, width: total * COL, todayLeft: idx(today, min) * COL + COL / 2 };
  }, [list, projectById, now, COLUMN_BY_KEY]);

  // одразу показуємо сьогоднішній день
  useEffect(() => {
    if (data && scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, data.todayLeft - 240);
  }, [data?.todayLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tboard-page">
      <TasksHeader scope={scope} onScope={setScope} />

      {!data ? (
        <div className="tgantt-empty">{t("Задач пока нет — создайте первую, и она появится на диаграмме.")}</div>
      ) : (
        <>
          <div className="tgantt">
            <div className="tgantt__legend">
              {LEGEND.map((key) => (
                <div key={key}>
                  <i style={{ background: COLUMN_BY_KEY[key].color }} />
                  {COLUMN_BY_KEY[key].label}
                </div>
              ))}
              <div className="tgantt__legend-today">
                <b />{t("Сегодня")}</div>
            </div>
            <div className="tgantt__body">
              <div className="tgantt__left">
                <div className="tgantt__left-head">{t("Задача")}</div>
                {data.groups.map((g) => (
                  <div key={g.key}>
                    <div className="tgantt__group">
                      <i style={{ background: g.color }} />
                      <div>{g.name}</div>
                      <span>{g.rows.length}</span>
                    </div>
                    {g.rows.map((r) => (
                      <button key={r.t.id} type="button" className="tgantt__task" onClick={() => openTask(r.t)}>
                        <i style={{ background: PRI_DOT[r.t.priority] || "#8a8f98" }} />
                        <div>
                          <div className="tgantt__task-title">{r.t.title}</div>
                          <div className="tgantt__task-who">{userById[r.t.assigneeId]?.name || ""}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="tgantt__right" ref={scrollRef}>
                <div style={{ position: "relative", width: data.width }}>
                  <div className="tgantt__days">
                    {data.days.map((d) => (
                      <div key={d.i}>
                        <div className={`tgantt__day ${d.weekend ? "is-weekend" : ""}`} style={{ left: d.i * COL }}>
                          <div className="tgantt__dow">{WEEKDAYS[d.wd]}</div>
                          <div className={`tgantt__num ${d.isToday ? "is-today" : ""}`}>{d.d.getDate()}</div>
                        </div>
                        {d.showMon && (
                          <div className="tgantt__mon" style={{ left: d.i * COL }}>
                            {MONTHS[d.d.getMonth()]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="tgantt__rows">
                    {data.days.map((d) => (
                      <div key={d.i} className={`tgantt__vline ${d.weekend ? "is-weekend" : ""}`} style={{ left: d.i * COL }} />
                    ))}
                    <div className="tgantt__today" style={{ left: data.todayLeft }} />
                    {data.groups.map((g) => (
                      <div key={g.key}>
                        <div className="tgantt__grow" />
                        {g.rows.map((r) => (
                          <div key={r.t.id} className="tgantt__row">
                            <button
                              type="button"
                              className="tgantt__bar"
                              title={`${r.t.title}: ${r.label}`}
                              style={{ left: r.left, width: r.width, background: r.color, opacity: r.t.status === "done" ? 0.55 : 1 }}
                              onClick={() => openTask(r.t)}
                            >
                              {r.inside && <span>{r.label}</span>}
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="tboard-note tgantt-note">{t("Полоса — период задачи (старт → дедлайн), цвет — статус, точка слева — приоритет. Клик по задаче открывает карточку. Прокручивайте таймлайн вправо.")}</div>

          {/* телефон: список по проектах з міні-смугами */}
          <div className="tgantt-mobile">
            {data.groups.map((g) => (
              <div key={g.key}>
                <div className="tgantt-mobile__group">
                  <i style={{ background: g.color }} />
                  <div>{g.name}</div>
                  <span>{g.rows.length}</span>
                </div>
                <div className="tgantt-mobile__list">
                  {g.rows.map((r) => (
                    <button
                      key={r.t.id}
                      type="button"
                      className="tgantt-mobile__item"
                      style={{ borderLeftColor: r.color }}
                      onClick={() => openTask(r.t)}
                    >
                      <div className="tgantt-mobile__top">
                        <i style={{ background: PRI_DOT[r.t.priority] || "#8a8f98" }} />
                        <div>{r.t.title}</div>
                        {isOverdue(r.t) && <span>❗</span>}
                      </div>
                      <div className="tgantt-mobile__track">
                        <div style={{ left: r.mLeft, width: r.mWidth, background: r.color }} />
                      </div>
                      <div className="tgantt-mobile__meta">
                        <span>{r.label}</span>
                        <span>{userById[r.t.assigneeId]?.name || ""}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {modal}
    </div>
  );
}

export default TaskGantt;
