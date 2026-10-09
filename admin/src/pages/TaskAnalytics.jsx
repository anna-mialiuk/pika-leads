import { useMemo, useState } from "react";

import { TasksHeader, useTaskModal } from "../components/TasksShell";
import { useAuth } from "../lib/auth";
import { useMeta } from "../lib/meta";
import { initials } from "../lib/projects";
import { formatShort, isOverdue, localDay, useTasks } from "../lib/tasks";

import "./TaskAnalytics.css";

const DAY = 864e5;
const PERIOD = 30; // днів для лідерборду
const AVATAR = ["#FFC629", "#5b9bff", "#f0883e", "#4fd88a", "#b98bff", "#4fd8c8", "#ff7d7d"];
const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_COLORS = ["#FFC629", "#c7ccd6", "#e0966a"];

const dayStart = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const readGoal = () => {
  try {
    return Math.max(1, Number(localStorage.getItem("tasks-daily-goal")) || 5);
  } catch {
    return 5;
  }
};

/** Аналітика задач (як у макеті): KPI, ціль на день, підказки, лідерборд, досягнення, зависші задачі */
function TaskAnalytics() {
  const { user } = useAuth();
  const { users, userById } = useMeta();
  const { tasks, loaded } = useTasks();
  const { modal, openTask } = useTaskModal();
  const [now] = useState(() => Date.now());
  const [goal, setGoal] = useState(readGoal);
  const [tipsShown, setTipsShown] = useState(false);

  const stats = useMemo(() => {
    const since = now - PERIOD * DAY;
    const today = dayStart(now);
    const isDone = (t) => t.status === "done";
    const done = tasks.filter(isDone);
    const open = tasks.filter((t) => !t.done);
    const overdue = open.filter(isOverdue);
    const timed = done.filter((t) => t.timeSpent > 0);

    // по співробітниках
    const people = users
      .filter((u) => !u.disabled)
      .map((u) => {
        const mine = tasks.filter((t) => t.assigneeId === u.id);
        const done30 = mine.filter((t) => isDone(t) && Date.parse(t.doneAt || t.createdAt) >= since);
        const onTime = done30.filter((t) => Date.parse(t.doneAt) <= Date.parse(t.dueAt));
        const early = done30.filter((t) => Date.parse(t.doneAt) < dayStart(Date.parse(t.dueAt)));
        const overdueOpen = mine.filter(isOverdue);
        const postponed = [...done30, ...mine.filter((t) => !t.done)].reduce((sum, t) => sum + (t.postponed || 0), 0);
        const base = done30.length + overdueOpen.length;
        const score = base
          ? Math.max(0, Math.min(100, Math.round((100 * (onTime.length + 0.5 * (done30.length - onTime.length))) / base) - postponed * 2))
          : null;
        // серія: дні поспіль (від сьогодні або вчора) з хоча б однією закритою задачею
        const days = new Set(mine.filter(isDone).map((t) => dayStart(Date.parse(t.doneAt || t.createdAt))));
        let streak = 0;
        let cursor = days.has(today) ? today : today - DAY;
        while (days.has(cursor)) {
          streak++;
          cursor -= DAY;
        }
        const allOnTime = mine.filter((t) => isDone(t) && Date.parse(t.doneAt) <= Date.parse(t.dueAt)).length;
        const done7 = mine.filter((t) => isDone(t) && Date.parse(t.doneAt) >= now - 7 * DAY).length;
        return {
          user: u,
          total: mine.filter((t) => !t.done || Date.parse(t.doneAt || t.createdAt) >= since).length,
          done: done30.length,
          rate: done30.length + overdueOpen.length ? Math.round((onTime.length / Math.max(1, done30.length)) * 100) : 0,
          score,
          streak,
          early: early.length,
          loss: overdueOpen.length * 5 + postponed * 2,
          overdue: overdueOpen.length,
          postponed,
          allOnTime,
          done7,
        };
      })
      .filter((p) => p.total > 0 || p.done > 0)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.done - a.done);

    const top = (key) => people.slice().sort((a, b) => b[key] - a[key])[0];
    const myDoneToday = tasks.filter(
      (t) => isDone(t) && (t.doneBy?.userId === user.id || t.assigneeId === user.id) && dayStart(Date.parse(t.doneAt)) === today,
    ).length;
    const me = people.find((p) => p.user.id === user.id);
    const myOpen = open.filter((t) => t.assigneeId === user.id);
    const tomorrow = localDay(new Date(now + DAY).toISOString());
    const dueTomorrow = myOpen.filter((t) => localDay(t.dueAt) === tomorrow);

    return {
      total: tasks.length,
      inWork: open.filter((t) => t.status !== "todo").length,
      done: done.length,
      donePct: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
      overdue: overdue.length,
      avgMinutes: timed.length ? Math.round(timed.reduce((s, t) => s + t.timeSpent, 0) / timed.length / 60) : 0,
      people,
      top,
      myDoneToday,
      me,
      myOpen,
      dueTomorrow,
      hanging: open
        .filter((t) => isOverdue(t) || t.priority === "high")
        .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || Date.parse(a.dueAt) - Date.parse(b.dueAt)),
    };
  }, [tasks, users, user.id, now]);

  const saveGoal = (value) => {
    const n = Math.max(1, Math.min(50, Math.round(Number(value) || 1)));
    setGoal(n);
    try {
      localStorage.setItem("tasks-daily-goal", String(n));
    } catch {
      /* приватний режим */
    }
  };

  const goalPct = Math.min(100, Math.round((stats.myDoneToday / goal) * 100));
  const left = Math.max(0, goal - stats.myDoneToday);

  // підказки з реальних даних
  const tips = [];
  if (stats.me?.overdue) {
    tips.push(
      `У вас ${stats.me.overdue} ${plural(stats.me.overdue, "просроченная задача", "просроченные задачи", "просроченных задач")} — закройте или перенесите сегодня: каждая стоит −5 к рейтингу.`,
    );
  }
  if (left > 0) tips.push(`Закройте ещё ${left} ${plural(left, "задачу", "задачи", "задач")} сегодня — и дневная цель выполнена.`);
  else tips.push("Дневная цель выполнена — так держать! Можно взять задачу из «Зависших».");
  if (stats.dueTomorrow.length) {
    const high = stats.dueTomorrow.find((t) => t.priority === "high") || stats.dueTomorrow[0];
    tips.push(`Завтра дедлайн у ${stats.dueTomorrow.length} ${plural(stats.dueTomorrow.length, "задачи", "задач", "задач")} — начните с «${high.title}», закрыв досрочно, получите ⚡ бонус.`);
  }
  if (stats.me?.postponed) {
    tips.push(`За месяц дедлайны переносились ${stats.me.postponed} раз — каждый перенос стоит −2 к Execution Score. Ставьте реалистичные сроки сразу.`);
  }
  if (stats.me && stats.me.streak > 0) tips.push(`Серия ${stats.me.streak} ${plural(stats.me.streak, "день", "дня", "дней")} подряд с закрытыми задачами — не прерывайте её завтра.`);
  if (!stats.me) tips.push("На вас пока нет задач — возьмите задачу на доске или поставьте себе первую.");

  const topOnTime = stats.top("allOnTime");
  const topStreak = stats.top("streak");
  const topEarly = stats.top("early");
  const topWeek = stats.people.filter((p) => p.overdue === 0).sort((a, b) => b.done7 - a.done7)[0];
  const achievements = [
    { icon: "🏆", label: "50 задач в срок", person: topOnTime, value: topOnTime?.allOnTime || 0, target: 50 },
    { icon: "🎖️", label: "Идеальная неделя: 5+ задач и ни одной просрочки", person: topWeek, value: topWeek?.done7 || 0, target: 5 },
    { icon: "🔥", label: "Серия 10 дней", person: topStreak, value: topStreak?.streak || 0, target: 10 },
    { icon: "⚡", label: "10 досрочных задач за месяц", person: topEarly, value: topEarly?.early || 0, target: 10 },
  ].map((a) => ({ ...a, progress: Math.min(100, Math.round((a.value / a.target) * 100)) }));

  const lbMax = Math.max(1, ...stats.people.map((p) => p.score ?? 0));

  return (
    <div className="tboard-page">
      <TasksHeader />
      {!loaded ? (
        <div className="content-loading">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="ta-kpis">
            <div>
              <span>Всего задач</span>
              <b style={{ color: "var(--accent)" }}>{stats.total}</b>
              <small>в работе {stats.inWork}</small>
            </div>
            <div>
              <span>Выполнено</span>
              <b style={{ color: "#4fd88a" }}>{stats.done}</b>
              <small>{stats.donePct}% от всех</small>
            </div>
            <div>
              <span>Просрочено</span>
              <b style={{ color: stats.overdue ? "#ff7d7d" : "var(--text)" }}>{stats.overdue}</b>
              <small>{stats.overdue ? "требуют внимания" : "всё в срок"}</small>
            </div>
            <div>
              <span>Ср. время задачи</span>
              <b style={{ color: "#5b9bff" }}>{stats.avgMinutes ? `${stats.avgMinutes} мин` : "—"}</b>
              <small>по таймеру</small>
            </div>
          </div>

          <div className="ta-split">
            <div className="ta-goal">
              <div className="ta-goal__ring" style={{ background: `conic-gradient(#FFC629 ${goalPct * 3.6}deg, var(--bg) 0deg)` }}>
                <div>{goalPct}%</div>
              </div>
              <div className="ta-goal__body">
                <div className="ta-goal__label">🎯 Цель на день</div>
                <div className="ta-goal__value">
                  {stats.myDoneToday} / {goal}
                </div>
                <div className="ta-goal__sub">{left > 0 ? `осталось ${left}` : "цель выполнена 🎉"}</div>
                <div className="ta-goal__input">
                  <span>Цель:</span>
                  <input type="number" min="1" max="50" value={goal} onChange={(e) => saveGoal(e.target.value)} aria-label="Цель на день" />
                  <span>задач</span>
                </div>
              </div>
            </div>
            <div className="ta-card ta-tips">
              <div className="ta-tips__head">
                <div className="ta-title">💡 Подсказки по продуктивности</div>
                <button type="button" className="ta-yellow" onClick={() => setTipsShown(true)}>
                  {tipsShown ? "Обновлено" : "Получить советы"}
                </button>
              </div>
              {tipsShown ? (
                <div className="ta-tips__list">
                  {tips.slice(0, 4).map((tip) => (
                    <div key={tip} className="ta-tip">
                      <span>💡</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ta-muted">Советы по вашим задачам: что закрыть сегодня, что горит завтра и как поднять рейтинг.</div>
              )}
            </div>
          </div>

          <div className="ta-card">
            <div className="ta-lb__head">
              <div className="ta-title ta-title--lg">🏆 Лидерборд команды</div>
              <div className="ta-muted">Execution Score · серии · бонусы · за {PERIOD} дней</div>
            </div>
            <div className="ta-muted ta-lb__text">
              Балл — доля задач, закрытых в срок (просроченные снижают), минус 2 за каждый перенос дедлайна. ⚡ — закрытые досрочно, 📉 — −5 за
              просрочку и −2 за перенос.
            </div>
            {stats.people.length === 0 ? (
              <div className="pd-empty">Пока нет задач с ответственными.</div>
            ) : (
              <div className="ta-lb">
                <div className="ta-lb__row ta-lb__row--head">
                  <div>#</div>
                  <div>Сотрудник</div>
                  <div>Execution Score</div>
                  <div>🔥 Серия</div>
                  <div>⚡ Бонус</div>
                  <div>📉 Потеря</div>
                </div>
                {stats.people.map((p, i) => {
                  const color = p.score === null ? "var(--muted)" : p.score >= 85 ? "#4fd88a" : p.score >= 70 ? "#FFC629" : "#ff9d5c";
                  return (
                    <div key={p.user.id} className={`ta-lb__row ${i === 0 ? "is-first" : ""}`}>
                      <div className="ta-lb__medal" style={{ color: i < 3 ? MEDAL_COLORS[i] : "var(--muted)" }}>
                        {i < 3 ? MEDALS[i] : i + 1}
                      </div>
                      <div className="ta-lb__who">
                        <div className="ta-lb__av" style={{ background: AVATAR[p.user.id % AVATAR.length] }}>
                          {initials(p.user.name)}
                        </div>
                        <div>
                          <div className="ta-lb__name">
                            {p.user.name}
                            {p.user.id === user.id && <span className="faint"> (вы)</span>}
                          </div>
                          <div className="ta-lb__sub">
                            {p.done}/{p.total} задач · {p.rate}% в срок
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="ta-lb__score" style={{ color }}>
                          {p.score ?? "—"}
                        </div>
                        <div className="ta-lb__bar">
                          <div style={{ width: `${Math.round(((p.score ?? 0) / lbMax) * 100)}%`, background: color }} />
                        </div>
                      </div>
                      <div className="ta-lb__extra">
                      <div className="ta-lb__cell" data-label="🔥">
                        {p.streak} дн.
                      </div>
                      <div className="ta-lb__cell ta-green" data-label="⚡">
                        +{p.early}
                      </div>
                      <div className="ta-lb__cell ta-red" data-label="📉">
                        {p.loss ? `−${p.loss}` : "0"}
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="ta-card">
            <div className="ta-title ta-title--lg ta-mb16">🎖️ Достижения</div>
            <div className="ta-ach">
              {achievements.map((a) => {
                const got = a.progress >= 100;
                return (
                  <div key={a.label} className={`ta-ach__item ${got ? "is-got" : ""}`}>
                    <div className="ta-ach__icon">{a.icon}</div>
                    <div className="ta-ach__label">{a.label}</div>
                    <div className="ta-ach__person">{a.person?.user.name || "—"}</div>
                    <div className="ta-ach__bar">
                      <div style={{ width: `${a.progress}%` }} />
                    </div>
                    <div className="ta-ach__status">{got ? "Получено" : `${a.value} из ${a.target}`}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ta-card">
            <div className="ta-title ta-title--lg">⚠ Зависшие задачи</div>
            <div className="ta-muted ta-lb__text">Просроченные и высокоприоритетные — требуют внимания.</div>
            {stats.hanging.length === 0 ? (
              <div className="pd-empty">Зависших задач нет 🎉</div>
            ) : (
              <div className="ta-hang">
                {stats.hanging.map((t) => {
                  const over = isOverdue(t);
                  return (
                    <button key={t.id} type="button" className="ta-hang__item" onClick={() => openTask(t)}>
                      <div className="ta-hang__top">
                        <span>{t.title}</span>
                        <b style={{ color: over ? "#ff7d7d" : "#FFC629" }}>{over ? "Просрочена" : "Высокий приоритет"}</b>
                      </div>
                      <div className="ta-hang__sub">
                        {userById[t.assigneeId]?.name || "—"} · дедлайн {formatShort(t.dueAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      {modal}
    </div>
  );
}

export default TaskAnalytics;
