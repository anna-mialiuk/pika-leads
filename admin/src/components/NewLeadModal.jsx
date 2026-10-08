import { useState } from "react";

import { ManagerSelect } from "./LeadParts";
import { ErrorAlert, Field, Modal } from "./ui";
import { api } from "../lib/api";

const SOURCES = ["Звонок", "Instagram", "Telegram", "WhatsApp", "Рекомендация", "Повторное обращение", "Другое"];

/** Ручне додавання ліда (дзвінок, месенджер, рекомендація) */
function NewLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone_full: "", telegram: "", email: "", niche: "", source: "Звонок", message: "", managerId: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() && !form.phone_full.trim() && !form.telegram.trim() && !form.email.trim()) {
      return setError("Укажите имя или хотя бы один контакт");
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
    <Modal title="Новый лид" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Для заявок, пришедших не через сайт: звонок, сообщение, рекомендация.
      </p>
      <form onSubmit={submit}>
        <Field label="Имя">
          <input className="input" value={form.name} onChange={set("name")} autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Телефон">
            <input className="input" type="tel" placeholder="+380…" value={form.phone_full} onChange={set("phone_full")} />
          </Field>
          <Field label="Telegram">
            <input className="input" placeholder="@username" value={form.telegram} onChange={set("telegram")} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Ниша">
            <input className="input" value={form.niche} onChange={set("niche")} />
          </Field>
          <Field label="Откуда">
            <select className="select" value={form.source} onChange={set("source")}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Менеджер">
            <ManagerSelect value={form.managerId} onChange={(managerId) => setForm((prev) => ({ ...prev, managerId }))} className="select" />
          </Field>
        </div>
        <Field label="Комментарий">
          <textarea className="textarea" value={form.message} onChange={set("message")} />
        </Field>
        <ErrorAlert error={error} />
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Добавить лид
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default NewLeadModal;
