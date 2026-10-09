import { useState } from "react";

import { ErrorAlert } from "../../components/ui";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { t, tt } from "../../lib/i18n";
import { BarRow, Card, Empty, Loading } from "./parts";
import { dropCache, fmtDur, fmtNum, fmtPct } from "./data";

const ClarityLogo = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="#7B68EE" strokeWidth="2" />
    <circle cx="12" cy="12" r="3.4" fill="#7B68EE" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="#7B68EE" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const path = (url) => {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
};

const DEVICE = { Mobile: t("Мобильные"), PC: t("Десктоп"), Tablet: t("Планшеты"), Other: t("Другое") };

export default function ClarityTab({ state }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (state.loading) return <Loading />;
  const c = state.data;

  if (!c?.configured) {
    return (
      <div className="an-connect">
        <div className="an-connect__logo">
          <ClarityLogo size={34} />
        </div>
        <h2>{t("Подключите Microsoft Clarity")}</h2>
        <p>{t("Метрики поведения: rage-клики, dead-клики, быстрые возвраты, глубина скролла, активное время — по страницам и устройствам.")}</p>
        <ol className="an-steps">
          <li>{t("Clarity → проект сайта → Settings → Data Export → Generate new API token.")}</li>
          <li>{t("Project ID — из адреса проекта: clarity.microsoft.com/projects/view/<ID>/…")}</li>
          <li>{t("Пропишите в .env сервера и перезапустите сервис:")}</li>
        </ol>
        <pre className="an-code">
          CLARITY_PROJECT_ID=o7q2k9x{"\n"}CLARITY_API_TOKEN=eyJhbGciOi…
        </pre>
        <small className="faint">{t("Данные подтягиваются через Clarity Data Export API: до 10 запросов в сутки, последние 3 дня. Синхронизация — раз в 8 часов.")}</small>
      </div>
    );
  }

  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/analytics/clarity/sync", { method: "POST" });
      dropCache("/analytics/clarity");
      state.set(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const d = c.data;
  const bar = (
    <div className="an-accbar">
      <ClarityLogo />
      <div>
        <b>{tt("Проект {0}", c.projectId)}</b>
        <small>{c.syncedAt ? tt("синхронизировано {0} · данные за 3 дня · запросов сегодня {1}/10", formatDate(c.syncedAt), c.callsToday) : t("ещё не синхронизировано")}</small>
      </div>
      <span className="an-pill is-ok">
        <i />
        {t("Активно")}
      </span>
      <span className="an-toolbar__spacer" />
      <button type="button" className="btn btn--sm" disabled={busy} onClick={sync}>
        {busy ? t("Обновляем…") : t("↻ Обновить")}
      </button>
      <a className="btn btn--sm an-btn-violet" href={c.dashboardUrl} target="_blank" rel="noreferrer noopener">
        {t("Открыть Clarity ↗")}
      </a>
    </div>
  );

  if (!d) {
    return (
      <div className="an-stack">
        {bar}
        <ErrorAlert error={error || c.error} />
        <Card>
          <Empty>{t("Данных пока нет — нажмите «Обновить», первая синхронизация занимает несколько секунд.")}</Empty>
        </Card>
      </div>
    );
  }

  const kpis = [
    [t("Сессии"), fmtNum(d.sessions), "var(--accent-ink)"],
    [t("Ср. активн. время"), fmtDur(d.activeTime), "var(--accent-ink)"],
    [t("Ср. глубина скролла"), fmtPct(d.scrollDepth, 0), "var(--accent-ink)"],
    [t("Rage-клики"), fmtPct(d.rage.pct), "var(--red-ink)"],
    [t("Dead-клики"), fmtPct(d.dead.pct), "var(--orange-ink)"],
    [t("Быстрые возвраты"), fmtPct(d.quickback.pct), "var(--orange-ink)"],
  ];
  const pages = d.pages || [];
  const worst = (key) => [...pages].sort((a, b) => b[key] - a[key])[0];
  const rageP = worst("rage");
  const deadP = worst("dead");
  const quickP = worst("quickback");
  const hotP = [...pages].sort((a, b) => b.sessions - a.sessions)[0];
  const insights = [
    { icon: "😤", color: "#ff7d7d", title: t("Rage-клики:"), value: fmtPct(d.rage.pct), desc: rageP?.rage ? tt("Больше всего на {0} ({1}% сессий) — элемент выглядит кликабельным, но не реагирует или реагирует медленно.", path(rageP.url), fmtNum(rageP.rage, 1)) : t("Пользователи многократно кликают в одно место — проверьте кнопки и формы.") },
    { icon: "💤", color: "#f0a83e", title: t("Dead-клики:"), value: fmtPct(d.dead.pct), desc: deadP?.dead ? tt("Чаще всего на {0} — кликают по некликабельным элементам. Сделайте их ссылками или уберите ложную «кнопочность».", path(deadP.url)) : t("Клики без реакции — проверьте картинки и карточки.") },
    { icon: "↩️", color: "#f0a83e", title: t("Быстрые возвраты:"), value: fmtPct(d.quickback.pct), desc: quickP?.quickback ? tt("Уходят назад с {0} — проверьте скорость первого экрана и соответствие оффера объявлению.", path(quickP.url)) : t("Пользователи быстро возвращаются назад — проверьте релевантность страниц.") },
    { icon: "🔥", color: "#5ac878", title: t("Горячая зона:"), value: hotP ? path(hotP.url) : "—", desc: t("Самая посещаемая страница — добавьте туда главный CTA и проверьте её тепловую карту.") },
  ];
  const devTotal = d.devices.reduce((s, x) => s + x.sessions, 0);
  const heatUrl = (url) => `${c.heatmapsUrl}?URL=${encodeURIComponent(url)}`;

  return (
    <div className="an-stack">
      {bar}
      <ErrorAlert error={error || c.error} />
      <div className="an-kpis an-kpis--6">
        {kpis.map(([label, value, color]) => (
          <div key={label} className="an-kpi">
            <div className="an-kpi__label">{label}</div>
            <div className="an-kpi__value an-kpi__value--sm" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="an-grid an-grid--2">
        <Card title={t("Страницы и тепловые карты")} sub={t("Сессии и доля сессий с проблемой · тепловая карта откроется в Clarity")} className="an-card--table">
          {pages.length ? (
            <div className="an-table-wrap">
              <table className="an-table an-table--compact">
                <thead>
                  <tr>
                    <th>{t("Страница")}</th>
                    <th className="num">{t("Сессии")}</th>
                    <th className="num">Rage</th>
                    <th className="num">Dead</th>
                    <th className="num">{t("Скролл")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pages.slice(0, 8).map((p) => (
                    <tr key={p.url}>
                      <td className="mono an-ellipsis" title={p.url}>
                        {path(p.url)}
                      </td>
                      <td className="num">{fmtNum(p.sessions)}</td>
                      <td className={`num ${p.rage >= 3 ? "bad" : "faint"}`}>{fmtPct(p.rage)}</td>
                      <td className={`num ${p.dead >= 5 ? "bad" : "faint"}`}>{fmtPct(p.dead)}</td>
                      <td className="num faint">{p.scroll ? fmtPct(p.scroll, 0) : "—"}</td>
                      <td className="num">
                        <a className="an-link" href={heatUrl(p.url)} target="_blank" rel="noreferrer noopener">
                          {t("карта ↗")}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t("Нет данных по страницам")}</Empty>
          )}
        </Card>
        <Card title={t("Проблемные зоны")}>
          <div className="an-stack an-stack--sm">
            {insights.map((i) => (
              <div key={i.title} className="an-insight" style={{ "--ins": i.color }}>
                <div className="an-insight__icon">{i.icon}</div>
                <div>
                  <b>
                    {i.title} <span>{i.value}</span>
                  </b>
                  <p>{i.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="an-grid an-grid--2">
        <Card title={t("Глубина скролла")} sub={t("Средняя глубина по страницам")}>
          {pages.some((p) => p.scroll) ? (
            <div className="an-list">
              {pages
                .filter((p) => p.scroll)
                .slice(0, 6)
                .map((p) => (
                  <BarRow key={p.url} label={path(p.url)} value={fmtPct(p.scroll, 0)} pct={p.scroll} color="#7B68EE" />
                ))}
            </div>
          ) : (
            <Empty>{tt("Средняя глубина по сайту — {0}", fmtPct(d.scrollDepth, 0))}</Empty>
          )}
        </Card>
        <Card title={t("Записи сессий")} sub={t("Сессии по устройствам за 3 дня")} right={<a className="an-link" href={c.recordingsUrl} target="_blank" rel="noreferrer noopener">{t("Смотреть записи ↗")}</a>}>
          <div className="an-list">
            {d.devices.map((x) => (
              <BarRow key={x.device} label={DEVICE[x.device] || x.device} value={fmtNum(x.sessions)} sub={`${Math.round((x.sessions / (devTotal || 1)) * 100)}%`} pct={(x.sessions / (d.devices[0]?.sessions || 1)) * 100} color="#9d8bff" />
            ))}
          </div>
          <div className="an-rows an-rows--top">
            <div>
              <span>{t("Боты (отфильтрованы)")}</span>
              <b>{fmtNum(d.botSessions)}</b>
            </div>
            <div>
              <span>{t("Страниц за сессию")}</span>
              <b>{fmtNum(d.pagesPerSession, 2)}</b>
            </div>
            <div>
              <span>{t("Ошибки JS")}</span>
              <b className={d.scriptErrors.pct >= 1 ? "bad" : ""}>{fmtPct(d.scriptErrors.pct)}</b>
            </div>
            <div>
              <span>{t("Избыточный скролл")}</span>
              <b>{fmtPct(d.excessiveScroll.pct)}</b>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
