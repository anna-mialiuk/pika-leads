import { useMemo, useState } from "react";

import { CopyButton, ErrorAlert } from "../../components/ui";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { t, tt } from "../../lib/i18n";
import { Card, Empty, Loading, Switch } from "./parts";
import { dropCache, fmtNum, fmtPct, useApi } from "./data";

const PLATFORMS = [
  { key: "meta", label: "Meta Ads", color: "#0866FF", source: "facebook", medium: "cpc" },
  { key: "google", label: "Google Ads", color: "#34A853", source: "google", medium: "cpc" },
  { key: "tiktok", label: "TikTok", color: "#25F4EE", source: "tiktok", medium: "paid" },
  { key: "manual", label: t("Вручную"), color: "var(--muted)", source: "", medium: "" },
];

/** Макроси платформ: підставляються самою рекламною системою в момент кліку */
const MACROS = {
  meta: [
    ["utm_campaign", "{{campaign.name}}", t("название кампании")],
    ["utm_content", "{{ad.name}}", t("название объявления")],
    ["campaign_id", "{{campaign.id}}", t("ID кампании")],
    ["adset_id", "{{adset.id}}", t("ID группы")],
    ["ad_id", "{{ad.id}}", t("ID объявления")],
    ["placement", "{{placement}}", t("плейсмент (feed/stories/reels)")],
    ["site_source", "{{site_source_name}}", "fb / ig / an / msg"],
  ],
  google: [
    ["utm_campaign", "{campaignid}", t("ID кампании (ValueTrack)")],
    ["utm_term", "{keyword}", t("ключевое слово")],
    ["utm_content", "{creative}", t("ID объявления")],
    ["adgroup_id", "{adgroupid}", t("ID группы")],
    ["network", "{network}", t("g (поиск) / s (партнёры) / d (КМС)")],
    ["device", "{device}", t("m / t / c (моб/планшет/пк)")],
    ["matchtype", "{matchtype}", t("тип соответствия")],
  ],
  tiktok: [
    ["utm_campaign", "__CAMPAIGN_NAME__", t("название кампании")],
    ["campaign_id", "__CAMPAIGN_ID__", t("ID кампании")],
    ["adgroup_id", "__AID__", t("ID группы")],
    ["ad_id", "__CID__", t("ID объявления")],
    ["utm_content", "__CID_NAME__", t("название объявления")],
    ["placement", "__PLACEMENT__", t("плейсмент")],
  ],
  manual: [],
};

const PLAT_LABEL = { meta: "Meta", google: "Google", tiktok: "TikTok", manual: t("Ручная") };
const PLAT_COLOR = Object.fromEntries(PLATFORMS.map((p) => [p.key, p.color]));

/** Параметри → рядок query без кодування фігурних дужок макросів */
const enc = (v) => encodeURIComponent(v).replace(/%7B/gi, "{").replace(/%7D/gi, "}");

export default function UtmTab({ gaReady }) {
  const linksQ = useApi("/analytics/links");
  const leadsQ = useApi("/leads");
  const gaQ = useApi("/analytics/ga4?period=30d", { enabled: gaReady, ttl: 10 * 60_000 });

  const [f, setF] = useState({ base: "https://pika-leads.com/", platform: "meta", source: "facebook", medium: "cpc", campaign: "", content: "", term: "", code: "", title: "" });
  const [dynamic, setDynamic] = useState(true);
  const [custom, setCustom] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const pickPlatform = (p) => {
    set({ platform: p.key, source: p.source || f.source, medium: p.medium || f.medium });
    setDynamic(p.key !== "manual");
  };

  // збірка посилання
  const built = useMemo(() => {
    let base = (f.base || "").trim().split("#")[0].split("?")[0];
    if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;
    const pairs = [];
    if (f.source) pairs.push(["utm_source", f.source]);
    if (f.medium) pairs.push(["utm_medium", f.medium]);
    if (f.campaign) pairs.push(["utm_campaign", f.campaign]);
    if (f.content) pairs.push(["utm_content", f.content]);
    if (f.term) pairs.push(["utm_term", f.term]);
    const dyn = dynamic ? MACROS[f.platform] || [] : [];
    dyn.forEach(([k, v]) => {
      if (!pairs.some((p) => p[0] === k)) pairs.push([k, v]);
    });
    custom.forEach((c) => c.key.trim() && pairs.push([c.key.trim(), c.val]));
    const params = pairs.map(([k, v]) => `${enc(k)}=${enc(v || "")}`).join("&");
    return { base, params, full: base + (params ? `?${params}` : ""), pairs, dynKeys: new Set(dyn.map((d) => d[0])) };
  }, [f, dynamic, custom]);

  const shortBase = linksQ.data?.shortBase || "https://pika-leads.com/go";
  const shortPreview = saved ? saved.short : `${shortBase}/${f.code || t("код")}`;

  const save = async () => {
    setError("");
    try {
      const { link } = await api("/analytics/links", { method: "POST", body: { base: built.base, params: built.params, platform: f.platform, code: f.code, title: f.title || f.campaign } });
      setSaved(link);
      dropCache("/analytics/links");
      linksQ.reload();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (link) => {
    if (!window.confirm(tt("Удалить ссылку {0}? Переходы по ней перестанут работать.", link.short))) return;
    try {
      await api(`/analytics/links/${link.id}`, { method: "DELETE" });
      dropCache("/analytics/links");
      linksQ.reload();
    } catch (e) {
      setError(e.message);
    }
  };

  // заявки для посилань і атрибуції
  const leads = useMemo(() => (leadsQ.data?.leads || []).filter((l) => !l.deleted), [leadsQ.data]);
  const linkRows = useMemo(
    () =>
      (linksQ.data?.links || []).map((l) => {
        const q = new URLSearchParams(l.params);
        const camp = q.get("utm_campaign");
        const src = q.get("utm_source");
        const isMacro = (v) => !v || /[{}]|__/.test(v);
        const count = leads.filter((lead) => {
          const a = lead.attribution || {};
          if (String(a.landingPage || "").includes(`pl=${l.code}`)) return true;
          return !isMacro(camp) && a.utm_campaign === camp && (isMacro(src) || a.utm_source === src);
        }).length;
        const refs = Object.entries(l.refs || {}).sort((x, y) => y[1] - x[1]);
        const refTotal = refs.reduce((s, r) => s + r[1], 0);
        return { ...l, leads: count, cr: l.clicks ? (count / l.clicks) * 100 : null, top: refs[0] ? `${refs[0][0]} · ${Math.round((refs[0][1] / refTotal) * 100)}%` : t("нет данных") };
      }),
    [linksQ.data, leads],
  );

  const gaData = gaQ.data;
  const attribution = useMemo(() => {
    const map = new Map();
    const keyOf = (src, med) => `${src}|${med}`;
    for (const lead of leads) {
      const a = lead.attribution || {};
      let src = a.utm_source;
      let med = a.utm_medium || "";
      if (!src) {
        try {
          src = a.referrer ? new URL(a.referrer).hostname.replace(/^www\./, "") : "(direct)";
        } catch {
          src = "(direct)";
        }
        med = src === "(direct)" ? "none" : /google|bing|yandex/.test(src) ? "organic (SEO)" : "referral";
      }
      const k = keyOf(src.toLowerCase(), med);
      const row = map.get(k) || { src, medium: med || "—", sessions: 0, leads: 0 };
      row.leads += 1;
      map.set(k, row);
    }
    for (const s of gaData?.sources || []) {
      const k = keyOf(String(s.sessionSource).toLowerCase(), s.sessionMedium);
      const row = map.get(k) || { src: s.sessionSource, medium: s.sessionMedium, sessions: 0, leads: 0 };
      row.sessions += s.sessions;
      map.set(k, row);
    }
    const rows = [...map.values()].sort((x, y) => y.sessions - x.sessions || y.leads - x.leads).slice(0, 8);
    const max = Math.max(1, ...rows.map((r) => (gaData ? r.sessions : r.leads)));
    return { rows, max };
  }, [leads, gaData]);

  if (linksQ.loading) return <Loading />;

  return (
    <div className="an-stack">
      <div>
        <div className="an-h2">{t("UTM-компоновщик и сокращатель ссылок")}</div>
        <p className="an-muted an-lead">{t("Соберите размеченную ссылку с UTM-метками и динамическими параметрами рекламных систем, сократите её и отслеживайте переходы. Сайт сохраняет метки каждого визита в заявке — источник попадает в CRM и сквозную аналитику.")}</p>
      </div>

      <div className="an-grid an-grid--utm">
        <Card className="an-utm">
          <label className="an-field">
            <span>{t("Ссылка назначения (домен / страница)")}</span>
            <input className="input" value={f.base} placeholder="https://pika-leads.com/lp" onChange={(e) => set({ base: e.target.value })} />
          </label>
          <span className="an-field__label">{t("Рекламная система")}</span>
          <div className="an-seg an-seg--wide">
            {PLATFORMS.map((p) => (
              <button key={p.key} type="button" className={f.platform === p.key ? "is-active" : ""} style={f.platform === p.key && p.key !== "manual" ? { background: p.color, color: p.key === "tiktok" ? "#111" : "#fff" } : undefined} onClick={() => pickPlatform(p)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="an-form__row an-form__row--2">
            <label className="an-field">
              <span>utm_source</span>
              <input className="input" value={f.source} placeholder="facebook" onChange={(e) => set({ source: e.target.value.trim() })} />
            </label>
            <label className="an-field">
              <span>utm_medium</span>
              <input className="input" value={f.medium} placeholder="cpc" onChange={(e) => set({ medium: e.target.value.trim() })} />
            </label>
          </div>
          <label className="an-field">
            <span>utm_campaign</span>
            <input className="input" value={f.campaign} placeholder={dynamic && f.platform !== "manual" ? t("пусто — подставит макрос платформы") : "clinic_ua_apr"} onChange={(e) => set({ campaign: e.target.value.trim() })} />
          </label>
          <div className="an-form__row an-form__row--2">
            <label className="an-field">
              <span>utm_content</span>
              <input className="input" value={f.content} placeholder="story_1" onChange={(e) => set({ content: e.target.value.trim() })} />
            </label>
            <label className="an-field">
              <span>utm_term</span>
              <input className="input" value={f.term} placeholder="keyword" onChange={(e) => set({ term: e.target.value.trim() })} />
            </label>
          </div>
          {f.platform !== "manual" && (
            <div className="an-dyn">
              <div className="an-dyn__head">
                <div>
                  <b>{t("Динамические параметры")}</b>
                  <small>{t("Макросы платформы подставят ID кампании, группы, объявления автоматически")}</small>
                </div>
                <Switch on={dynamic} label={t("Динамические параметры")} color="#5ac878" onChange={setDynamic} />
              </div>
              {dynamic &&
                MACROS[f.platform].map(([k, v, d]) => (
                  <div key={k} className="an-dyn__row">
                    <code className="accent">{k}</code>
                    <code>{v}</code>
                    <span className="faint">{d}</span>
                  </div>
                ))}
            </div>
          )}
          <span className="an-field__label">{t("Кастомные параметры")}</span>
          {custom.map((c, i) => (
            <div key={i} className="an-custom">
              <input className="input input--sm" value={c.key} placeholder={t("ключ")} onChange={(e) => setCustom((list) => list.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
              <span>=</span>
              <input className="input input--sm" value={c.val} placeholder={t("значение")} onChange={(e) => setCustom((list) => list.map((x, j) => (j === i ? { ...x, val: e.target.value } : x)))} />
              <button type="button" className="icon-btn" aria-label={t("Удалить")} onClick={() => setCustom((list) => list.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="an-link" onClick={() => setCustom((list) => [...list, { key: "", val: "" }])}>
            ＋ {t("Добавить параметр")}
          </button>
        </Card>

        <Card className="an-utm-out">
          <div className="an-cap">{t("Готовые ссылки")}</div>
          <div className="an-out">
            <div className="an-out__head">
              <span className="good">🔗 {t("Сокращённая")}</span>
              {saved && (
                <CopyButton value={saved.short} className="an-link" label={t("Копировать")}>
                  {t("Копировать")}
                </CopyButton>
              )}
            </div>
            <div className="an-out__short">{shortPreview}</div>
            {!saved && (
              <label className="an-field an-field--inline">
                <span>{t("Свой код (необязательно)")}</span>
                <input className="input input--sm" value={f.code} maxLength={32} placeholder="clinic-apr" onChange={(e) => set({ code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
              </label>
            )}
          </div>
          <div className="an-out">
            <div className="an-out__head">
              <span className="accent">{t("Полная с метками")}</span>
              <CopyButton value={built.full} className="an-link" label={t("Копировать")}>
                {t("Копировать")}
              </CopyButton>
            </div>
            <div className="an-out__url">{built.full || "—"}</div>
          </div>
          <div className="an-out">
            <div className="an-out__head">
              <span className="faint">{t("Чистая (без меток)")}</span>
              <CopyButton value={built.base} className="an-link" label={t("Копировать")}>
                {t("Копировать")}
              </CopyButton>
            </div>
            <div className="an-out__url faint">{built.base || "—"}</div>
          </div>
          <div className="an-out__chips">
            {built.pairs.map(([k, v]) => (
              <span key={k} className={built.dynKeys.has(k) ? "is-dyn" : ""}>
                <b>{k}</b>={v || "—"}
              </span>
            ))}
          </div>
          {dynamic && f.platform !== "manual" && <p className="an-hint">{t("В объявление вставляйте полную ссылку — макросы подставит платформа. Короткую — для био, сторис и мессенджеров: в ней макросы не заменяются.")}</p>}
          <ErrorAlert error={error} />
          {saved ? (
            <button type="button" className="btn btn--block" onClick={() => setSaved(null)}>
              {t("Собрать новую ссылку")}
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--block" disabled={!built.base} onClick={save}>
              {t("Сохранить и отслеживать")}
            </button>
          )}
        </Card>
      </div>

      <div>
        <div className="an-h3">{t("Мои ссылки")}</div>
        <Card className="an-card--table">
          {linkRows.length ? (
            <div className="an-table-wrap">
              <table className="an-table">
                <thead>
                  <tr>
                    <th>{t("Кампания")}</th>
                    <th>{t("Короткая")}</th>
                    <th className="num">{t("Клики")}</th>
                    <th className="num">{t("Лиды")}</th>
                    <th className="num">CR</th>
                    <th>{t("Топ-источник")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {linkRows.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="an-linkcell">
                          <i style={{ background: PLAT_COLOR[l.platform] }} />
                          <div>
                            <b>{l.title}</b>
                            <small className="faint">
                              {PLAT_LABEL[l.platform]} · {formatDate(l.createdAt, { time: false })}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <CopyButton value={l.short} className="an-chipbtn" label={t("Копировать")}>
                          {l.short.replace(/^https?:\/\//, "")}
                        </CopyButton>
                      </td>
                      <td className="num">
                        <b>{fmtNum(l.clicks)}</b>
                      </td>
                      <td className="num">{fmtNum(l.leads)}</td>
                      <td className="num good">{l.cr === null ? "—" : fmtPct(l.cr)}</td>
                      <td className="faint">{l.top}</td>
                      <td className="num an-nowrap">
                        <CopyButton value={l.full} className="an-link" label={t("Копировать URL")}>
                          {t("Копировать URL")}
                        </CopyButton>
                        <button type="button" className="icon-btn" aria-label={t("Удалить")} title={t("Удалить")} onClick={() => remove(l)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t("Сохранённых ссылок пока нет — соберите первую выше.")}</Empty>
          )}
        </Card>
      </div>

      <div>
        <div className="an-h3row">
          <div className="an-h3">{t("Атрибуция трафика")}</div>
          <span className="faint">{gaQ.data ? t("Сессии — GA4 за 30 дней, лиды — CRM за всё время") : t("Что сайт сохраняет с каждой заявки: UTM · referrer · SEO · direct")}</span>
        </div>
        <Card>
          {attribution.rows.length ? (
            <div className="an-attr">
              {attribution.rows.map((r, i) => (
                <div key={`${r.src}${r.medium}`} className="an-attr__row">
                  <i style={{ background: ["#0866FF", "#34A853", "#25F4EE", "#f0a83e", "var(--muted)", "#9d8bff", "#ff6fae", "#4fd8c8"][i] }} />
                  <div className="an-attr__name">
                    <b>{r.src}</b> <span className="faint">/ {r.medium}</span>
                  </div>
                  <div className="an-bar">
                    <div style={{ width: `${((gaQ.data ? r.sessions : r.leads) / attribution.max) * 100}%`, background: ["#0866FF", "#34A853", "#25F4EE", "#f0a83e", "var(--muted)", "#9d8bff", "#ff6fae", "#4fd8c8"][i] }} />
                  </div>
                  {gaQ.data && (
                    <div className="an-attr__num">
                      <b>{fmtNum(r.sessions)}</b> {t("сессий")}
                    </div>
                  )}
                  <div className="an-attr__leads good">{tt("{0} лид.", fmtNum(r.leads))}</div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t("Заявок пока нет")}</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
