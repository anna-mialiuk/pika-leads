import { useState } from "react";

import { ManagerSelect } from "./LeadParts";
import { ErrorAlert, Field, Modal } from "./ui";
import { api } from "../lib/api";
import { t } from "../lib/i18n";

const SOURCES = [t("Звонок"), "Instagram", "Telegram", "WhatsApp", t("Рекомендация"), t("Повторное обращение"), t("Другое")];

/** Ручне додавання ліда (дзвінок, месенджер, рекомендація) */
function NewLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone_full: "", telegram: "", email: "", niche: "", source: t("Звонок"), message: "", managerId: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() && !form.phone_full.trim() && !form.telegram.trim() && !form.email.trim()) {
      return setError(t("Укажите имя или хотя бы один контакт"));
    }
    setBusy(true);
    setError("");
    try {
      const { lead } = await api("/leads", { method: "POST", body: form });
      onCreated(lead);
    } catch (createError) {
      setError(createError.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={t("Новый лид")} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>{t("Для заявок, пришедших не через сайт: звонок, сообщение, рекомендация.")}</p>
      <form onSubmit={submit}>
        <Field label={t("Имя")}>
          <input className="input" value={form.name} onChange={set("name")} autoFocus />
        </Field>
        <div className="form-grid">
          <Field label={t("Телефон")}>
            <input className="input" type="tel" placeholder="+380…" value={form.phone_full} onChange={set("phone_full")} />
          </Field>
          <Field label="Telegram">
            <input className="input" placeholder="@username" value={form.telegram} onChange={set("telegram")} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label={t("Ниша")}>
            <input className="input" value={form.niche} onChange={set("niche")} />
          </Field>
          <Field label={t("Откуда")}>
            <select className="select" value={form.source} onChange={set("source")}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label={t("Менеджер")}>
            <ManagerSelect value={form.managerId} onChange={(managerId) => setForm((prev) => ({ ...prev, managerId }))} className="select" />
          </Field>
        </div>
        <Field label={t("Комментарий")}>
          <textarea className="textarea" value={form.message} onChange={set("message")} />
        </Field>
        <ErrorAlert error={error} />
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>{t("Отмена")}</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{t("Добавить лид")}</button>
        </div>
      </form>
    </Modal>
  );
}

export default NewLeadModal;
