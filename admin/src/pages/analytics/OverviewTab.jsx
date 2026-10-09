import { useNavigate } from "react-router-dom";

import { useAuth } from "../../lib/auth";
import { t, tt } from "../../lib/i18n";
import { useProjects } from "../../lib/projects";
import { can } from "../../lib/roles";
import { useTasks } from "../../lib/tasks";
import { Bar, Card, Empty, Loading, Ring } from "./parts";
import { PLATFORM, fmtMoney, fmtNum, fmtPct, nicheColor, useApi } from "./data";

/** Агрегати по кабінетах (спільні для «Обзора» і помічника) */
function portfolio(cabinets) {
  const cur = cabinets[0]?.currency || "USD";
  const sum = (key) => cabinets.reduce((s, c) => s + (c.summary?.[key] || 0), 0);
  const spend = sum("spend");
  const conv = sum("conv");
  const clicks = sum("clicks");
  const impressions = sum("impressions");
  const todaySpend = cabinets.reduce((s, c) => s + (c.summary?.today?.spend || 0), 0);
  const budget = cabinets.reduce((s, c) => s + (c.budget || 0), 0);
  const active = cabinets.filter((c) => c.status === "active");
  const cpas = active.map((c) => c.summary.cpa).filter((x) => x > 0).sort((a, b) => a - b);
  const median = cpas.length ? cpas[Math.floor(cpas.length / 2)] : 0;
  const effCount = active.filter((c) => c.summary.cpa > 0 && c.summary.cpa <= median).length;
  const eff = cabinets.length ? Math.min(100, Math.round((effCount / cabinets.length) * 100 + (active.length / cabinets.length) * 30)) : 0;
  return {
    cur,
    spend,
    conv,
    clicks,
    impressions,
    cpa: conv ? spend / conv : 0,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    todaySpend,
    budget,
    pacing: budget ? (todaySpend / budget) * 100 : 0,
    active: active.length,
    issues: cabinets.length - active.length,
    median,
    eff,
  };
}

const effColor = (v) => (v >= 60 ? "#5ac878" : v >= 35 ? "#FFC629" : "#ff7d7d");

function group(cabinets, keyOf, total) {
  const map = new Map();
  cabinets.forEach((c) => {
    const key = keyOf(c);
    const g = map.get(key) || { key, spend: 0, leads: 0, count: 0 };
    g.spend += c.summary.spend;
    g.leads += c.summary.conv;
    g.count += 1;
    map.set(key, g);
  });
  return [...map.values()].map((g) => ({ ...g, pct: total ? (g.spend / total) * 100 : 0, cpa: g.leads ? g.spend / g.leads : 0 })).sort((a, b) => b.spend - a.spend);
}

export default function OverviewTab({ go }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const { data, error, loading } = useApi("/analytics/overview");
  const cases = useApi("/content/cases", { ttl: 10 * 60_000, enabled: can(user, "content") });

  if (loading) return <Loading />;
  if (error) return <div className="alert">⚠ {error}</div>;

  const cabs = data.cabinets;
  const p = portfolio(cabs);
  const byPlat = group(cabs, (c) => c.platform, p.spend);
  const byNiche = group(cabs, (c) => c.niche || t("Прочее"), p.spend);
  const openTasks = tasks.filter((x) => !x.done).length;
  const activeProj = projects.filter((x) => x.status === "active").length;

  const work = [
    { label: t("Проектов"), value: projects.length, sub: tt("{0} активных", activeProj), color: "#4fd88a", to: () => navigate("/tasks/projects") },
    { label: t("Задач в работе"), value: openTasks, sub: tt("из {0} всего", tasks.length), color: "#FFC629", to: () => navigate("/tasks") },
    { label: t("Майнд-карт"), value: data.mindmaps, sub: t("схем и связей"), color: "#b98bff", to: () => navigate("/tasks/mindmaps") },
    can(user, "content")
      ? { label: t("Кейсов"), value: cases.data?.items?.length ?? "…", sub: t("в портфолио"), color: "#6fa8ff", to: () => navigate("/cases") }
      : { label: t("Кабинетов"), value: cabs.length, sub: tt("{0} активны", p.active), color: "#6fa8ff", to: () => go("ads") },
  ];

  return (
    <div className="an-stack">
      {cabs.length === 0 ? (
        <Card>
          <Empty>
            {t("Рекламные кабинеты ещё не подключены — сводка появится после подключения.")}{" "}
            <button type="button" className="an-link" onClick={() => go("ads")}>
              {t("Подключить кабинет →")}
            </button>
          </Empty>
        </Card>
      ) : (
        <>
          <div className="an-grid an-grid--ov">
            <Card title={t("Сводка по всем кабинетам")} right={<span className="an-card__note">{tt("{0} кабинетов · {1} активны · {2} с проблемами · 30 дней", cabs.length, p.active, p.issues)}</span>}>
              <div className="an-minis">
                <div>
                  <span>{t("Общий спенд")}</span>
                  <b>{fmtMoney(p.spend, p.cur, 0)}</b>
                </div>
                <div>
                  <span>{t("Лидов")}</span>
                  <b>{fmtNum(p.conv)}</b>
                </div>
                <div>
                  <span>{t("Ср. CPA")}</span>
                  <b>{p.cpa ? fmtMoney(p.cpa, p.cur, 1) : "—"}</b>
                </div>
                <div>
                  <span>{t("Ср. CTR")}</span>
                  <b>{fmtPct(p.ctr, 2)}</b>
                </div>
              </div>
              <div className="an-pacing">
                <div>
                  <span>{p.budget ? tt("{0}% дневного бюджета освоено сегодня", Math.round(p.pacing)) : t("Дневные бюджеты не заданы")}</span>
                  <span>{p.budget ? tt("Бюджет {0}/день", fmtMoney(p.budget, p.cur, 0)) : ""}</span>
                </div>
                <Bar value={p.pacing} max={100} color="linear-gradient(90deg, #FFC629, #f0a83e)" height={8} />
              </div>
            </Card>
            <Card className="an-eff">
              <Ring value={p.eff} color={effColor(p.eff)} size={100} stroke={10} sub={t("из 100")} />
              <div>
                <div className="an-card__title">{t("Эффективность портфеля")}</div>
                <div className="an-eff__label" style={{ color: effColor(p.eff) }}>
                  {p.eff >= 60 ? t("Высокая") : p.eff >= 35 ? t("Средняя") : t("Низкая")}
                </div>
                <p className="an-muted">{tt("Доля кабинетов с CPA не выше медианы + активность связок. Кликов за период — {0}.", fmtNum(p.clicks))}</p>
              </div>
            </Card>
          </div>

          <div className="an-grid an-grid--2">
            <Card title={t("Спенд по платформам")}>
              <div className="an-list">
                {byPlat.map((g) => (
                  <div key={g.key} className="an-split">
                    <div className="an-split__top">
                      <span>
                        <i style={{ background: PLATFORM[g.key]?.color }} />
                        <b>{PLATFORM[g.key]?.label || g.key}</b>
                        <span className="faint"> · {tt("{0} каб.", g.count)}</span>
                      </span>
                      <b>{fmtMoney(g.spend, p.cur, 0)}</b>
                    </div>
                    <Bar value={g.pct} max={100} color={PLATFORM[g.key]?.color} height={7} />
                    <div className="an-split__meta">
                      <span>{tt("{0} лидов", fmtNum(g.leads))}</span>
                      <span>CPA {g.cpa ? fmtMoney(g.cpa, p.cur, 1) : "—"}</span>
                      <span>{tt("{0}% спенда", Math.round(g.pct))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title={t("Распределение по нишам")}>
              <div className="an-list">
                {byNiche.map((g, i) => (
                  <div key={g.key} className="an-split">
                    <div className="an-split__top">
                      <span>
                        <i style={{ background: nicheColor(g.key, i) }} />
                        <b>{g.key}</b>
                      </span>
                      <b>{fmtMoney(g.spend, p.cur, 0)}</b>
                    </div>
                    <Bar value={g.pct} max={100} color={nicheColor(g.key, i)} height={7} />
                    <div className="an-split__meta">
                      <span>{tt("{0} лидов", fmtNum(g.leads))}</span>
                      <span>CPA {g.cpa ? fmtMoney(g.cpa, p.cur, 1) : "—"}</span>
                      <span>{tt("{0} каб.", g.count)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      <div className="an-work">
        {work.map((w) => (
          <button key={w.label} type="button" className="an-work__card" style={{ "--work": w.color }} onClick={w.to}>
            <b style={{ color: `color-mix(in srgb, ${w.color}, #000 var(--ink-darken, 0%))` }}>{w.value}</b>
            <span>{w.label}</span>
            <small>{w.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
