import { useEffect, useMemo, useState } from "react";

import { ErrorAlert } from "../components/ui";
import { Toggle } from "../components/content/fields";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useMeta } from "../lib/meta";

import "./Content.css";
import "./Integrations.css";
import { t, tt } from "../lib/i18n";

const META_HINTS = {
  Lead: t("Лид"),
  Contact: t("Контакт"),
  Schedule: t("Запись / встреча"),
  SubmitApplication: t("Заявка подана"),
  CompleteRegistration: t("Регистрация"),
  Purchase: t("Покупка (с суммой сделки)"),
};
const GA4_HINTS = {
  working_lead: t("Лид в работе"),
  qualify_lead: t("Квалифицирован"),
  disqualify_lead: t("Не квалифицирован"),
  close_convert_lead: t("Сделка выиграна"),
  close_unconvert_lead: t("Сделка проиграна"),
  purchase: t("Покупка (с суммой сделки)"),
};

/** Подія: стандартна зі списку або своя назва */
function EventSelect({ value, options, hints, onChange, placeholder }) {
  const custom = value && !options.includes(value);
  const [editing, setEditing] = useState(custom);
  if (editing) {
    return (
      <div className="event-custom">
        <input
          className="input input--sm mono"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.trim())}
        />
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={() => {
            setEditing(false);
            if (!options.includes(value)) onChange("");
          }}
        >{t("Список")}</button>
      </div>
    );
  }
  return (
    <select
      className="select select--sm"
      value={value || ""}
      onChange={(e) => (e.target.value === "__custom" ? setEditing(true) : onChange(e.target.value))}
    >
      <option value="">{t("— не отправлять —")}</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
          {hints[name] ? ` · ${hints[name]}` : ""}
        </option>
      ))}
      <option value="__custom">{t("Своё событие…")}</option>
    </select>
  );
}

function Integrations() {
  const { statuses } = useMeta();
  const [info, setInfo] = useState(null);
  const [settings, setSettings] = useState(null);
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/integrations")
      .then((data) => {
        setInfo(data);
        setSettings(data.settings);
      })
      .catch((loadError) => setError(loadError.message));
    api("/leads")
      .then(({ leads: list }) => setLeads(list))
      .catch(() => {});
  }, []);

  const recent = useMemo(
    () =>
      leads
        .flatMap((lead) => (lead.events || []).map((e) => ({ ...e, leadId: lead.id })))
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 30),
    [leads],
  );

  const setRule = (code, platform, value) =>
    setSettings((prev) => ({ ...prev, rules: { ...prev.rules, [code]: { ...(prev.rules[code] || {}), [platform]: value } } }));

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await api("/integrations", { method: "PUT", body: settings });
      setInfo(data);
      setSettings(data.settings);
      setNotice(t("Сохранено. Новые правила действуют для следующих изменений статуса."));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!info || !settings) {
    return (
      <div className="content-page">
        <ErrorAlert error={error} />
        {!error && (
          <div className="content-loading">
            <div className="spinner" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="content-page integrations">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("Интеграции")}</h1>
          <p className="page-text">{t("Серверные события в рекламу и аналитику: заявки с сайта и статусы из CRM.")}</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
          {saving ? t("Сохраняем…") : t("Сохранить")}
        </button>
      </div>

      <ErrorAlert error={error} />
      {notice && <div className="alert alert--ok">✓ {notice}</div>}

      <div className="int-cards">
        <div className="card int-card">
          <div className={`int-card__status ${info.meta.configured ? "is-on" : ""}`}>
            {info.meta.configured ? t("Подключено") : t("Не подключено")}
          </div>
          <h2>Meta Conversions API</h2>
          <p className="muted">
            {info.meta.configured
              ? tt("Пиксель {0}. Заявка с сайта уходит и из браузера, и с сервера — Meta склеивает их в одно событие.", info.meta.pixelId)
              : t("Нужны META_PIXEL_ID и META_CAPI_TOKEN в .env сервера.")}
          </p>
        </div>
        <div className="card int-card">
          <div className={`int-card__status ${info.ga4.configured ? "is-on" : ""}`}>
            {info.ga4.configured ? t("Подключено") : t("Не подключено")}
          </div>
          <h2>Google Analytics 4 (Measurement Protocol)</h2>
          <p className="muted">
            {info.ga4.configured
              ? tt("Поток {0}. Статусы из CRM уходят как события того же посетителя.", info.ga4.measurementId)
              : t("Нужны GA4_MEASUREMENT_ID и GA4_API_SECRET в .env сервера.")}
          </p>
        </div>
      </div>

      <section className="form-section card">
        <div className="form-section__head form-section__head--static">
          <h2>{t("События по статусам CRM")}</h2>
        </div>
        <div className="form-section__body">
          <p className="muted int-text">{t("Когда заявка переходит в статус — с сервера уходит событие (один раз на заявку). Для «Покупки» нужна сумма сделки в карточке заявки: без неё событие подождёт, пока сумму укажут.")}</p>
          <div className="int-rules">
            <div className="int-rules__head">
              <span>{t("Статус")}</span>
              <span>Meta</span>
              <span>Google Analytics 4</span>
            </div>
            {statuses
              .filter((s) => s.code !== "new")
              .map((status) => (
                <div key={status.code} className="int-rules__row">
                  <span className="int-rules__status">
                    <i style={{ background: status.color }} />
                    {status.label}
                  </span>
                  <EventSelect
                    value={settings.rules[status.code]?.meta || ""}
                    options={info.metaEvents}
                    hints={META_HINTS}
                    placeholder="QualifiedLead"
                    onChange={(value) => setRule(status.code, "meta", value)}
                  />
                  <EventSelect
                    value={settings.rules[status.code]?.ga4 || ""}
                    options={info.ga4Events}
                    hints={GA4_HINTS}
                    placeholder="my_event"
                    onChange={(value) => setRule(status.code, "ga4", value)}
                  />
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="form-section card">
        <div className="form-section__head form-section__head--static">
          <h2>{t("Настройки")}</h2>
        </div>
        <div className="form-section__body">
          <div className="schema-field schema-field--half">
            <div className="field__label">{t("Валюта сделок")}</div>
            <select className="select" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
              {["USD", "EUR", "UAH", "PLN"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="schema-field schema-field--half">
            <div className="field__label">{t("Тестовый код событий Meta")}</div>
            <input
              className="input mono"
              value={settings.testEventCode}
              placeholder="TEST12345"
              onChange={(e) => setSettings({ ...settings, testEventCode: e.target.value.trim() })}
            />
            <div className="schema-field__hint">{t("Events Manager → Тестовые события. После проверки очистите поле.")}</div>
          </div>
          <div className="schema-field">
            <Toggle
              checked={settings.requireConsent}
              onChange={(checked) => setSettings({ ...settings, requireConsent: checked })}
              label={t("Отправлять в Meta только при согласии посетителя на маркетинговые cookie")}
            />
            <div className="schema-field__hint">{t("Так требует GDPR и ваш баннер cookie. Если выключить — заявки уходят в Meta всегда; решение за вами.")}</div>
          </div>
        </div>
      </section>

      <section className="form-section card">
        <div className="form-section__head form-section__head--static">
          <h2>{t("Последние отправки")}</h2>
        </div>
        <div className="form-section__body">
          {recent.length === 0 && <p className="muted">{t("Пока ничего не отправлялось.")}</p>}
          <ul className="lead-events int-log">
            {recent.map((e, index) => (
              <li key={index} className={e.ok ? "is-ok" : e.skipped ? "is-skip" : "is-error"}>
                <span>
                  {e.ok ? "✓" : e.skipped ? "–" : "⚠"} #{e.leadId} · {e.platform === "ga4" ? "GA4" : "Meta"}: <b>{e.event}</b>
                  {e.error && <small> — {e.error}</small>}
                  {e.skipped && <small> — {e.skipped}</small>}
                </span>
                <span className="faint">{formatDate(e.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default Integrations;
