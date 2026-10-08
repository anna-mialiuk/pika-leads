import { useRef, useState } from "react";

import Icon from "../Icon";
import {
  IMAGE_PRESETS,
  convertImage,
  dataUrlSize,
  getIn,
  isLocalized,
  locText,
  previewOf,
  setIn,
  setLocText,
  uploadKey,
} from "../../lib/content";

const splitKey = (key) => key.split(".");

/** Текстове поле, що росте разом із текстом */
export function AutoTextarea({ value, onChange, rows = 3, className = "textarea", ...props }) {
  return (
    <textarea
      className={`${className} autogrow`}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      ref={(node) => {
        if (!node) return;
        node.style.height = "auto";
        node.style.height = `${Math.max(node.scrollHeight + 2, rows * 22 + 26)}px`;
      }}
      {...props}
    />
  );
}

/** Перекладний текст: показує мову lang, для EN/RU — підказка з українського */
function LocalizedField({ field, value, lang, onChange }) {
  const text = locText(value, lang);
  const uk = locText(value, "uk");
  const missing = lang !== "uk" && uk && !text && /\p{L}/u.test(uk);
  const placeholder = lang === "uk" ? field.placeholder || "" : uk ? `UA: ${uk}` : field.placeholder || "";
  const common = {
    value: text,
    placeholder,
    onChange: (next) => onChange(setLocText(value, lang, next)),
  };
  return (
    <div className={`loc-field ${missing ? "loc-field--missing" : ""}`}>
      {field.type === "textarea" ? (
        <AutoTextarea {...common} rows={field.rows || 4} />
      ) : (
        <input className="input" {...common} onChange={(event) => common.onChange(event.target.value)} />
      )}
      {lang !== "uk" && uk && (
        <button
          type="button"
          className="loc-field__copy"
          title="Скопировать украинский текст"
          onClick={() => onChange(setLocText(value, lang, uk))}
        >
          UA → {lang.toUpperCase()}
        </button>
      )}
    </div>
  );
}

function SelectField({ field, value, onChange }) {
  const options = field.options || [];
  const known = options.some((option) => option.value === value);
  return (
    <select className="select" value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)}>
      {(field.empty || !value) && <option value="">{field.empty || "— выберите —"}</option>}
      {!known && value && <option value={value}>{value} (нестандартное значение)</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ColorField({ value, onChange }) {
  const color = /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#4FD88A";
  return (
    <div className="color-field">
      <input type="color" value={color} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      <input className="input mono" value={value || ""} placeholder="#4FD88A" onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle__track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

/**
 * Картинка: завантаження з комп'ютера (або перетягуванням), конвертація у WebP
 * у браузері. Нова картинка зберігається як "upload:<ключ>" до натискання «Сохранить».
 */
export function ImageUpload({ value, uploads, onUpload, onChange, preset = "screenshot", extra, compact = false }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const src = previewOf(value, uploads);
  const uploadMatch = /^upload:(.+)$/.exec(value || "");

  const handle = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await convertImage(file, IMAGE_PRESETS[preset]);
      const key = uploadKey();
      onUpload(key, dataUrl);
      const extraValue = await extra?.(file);
      onChange(`upload:${key}`, extraValue);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`image-field ${compact ? "image-field--compact" : ""} ${over ? "is-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        handle(event.dataTransfer.files?.[0]);
      }}
    >
      <div className="image-field__preview" onClick={() => input.current?.click()}>
        {busy ? <div className="spinner" /> : src ? <img src={src} alt="" /> : <span>Перетащите картинку или нажмите</span>}
      </div>
      <div className="image-field__side">
        <div className="image-field__actions">
          <button type="button" className="btn btn--sm" onClick={() => input.current?.click()} disabled={busy}>
            <Icon name="upload" /> {value ? "Заменить" : "Загрузить"}
          </button>
          {value && (
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange("")} disabled={busy}>
              Убрать
            </button>
          )}
        </div>
        <div className="image-field__info">
          {uploadMatch && uploads[uploadMatch[1]]
            ? `Новая · WebP · ${dataUrlSize(uploads[uploadMatch[1]])} КБ · сохранится вместе с записью`
            : value
              ? value.split("/").pop()
              : ""}
        </div>
        {error && <div className="field-error">⚠ {error}</div>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          handle(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

/** Значення поля для порожнього нового елемента списку */
const emptyOf = (fields) => {
  const result = {};
  for (const field of fields) {
    if (field.type === "text" || field.type === "textarea") result[field.key] = { uk: "" };
    if (field.type === "select" && field.options?.length && !field.empty) result[field.key] = field.options[0].value;
  }
  return result;
};

function ListControls({ index, length, onMove, onRemove }) {
  return (
    <div className="list-item__controls">
      <button
        type="button"
        className="icon-btn icon-btn--sm"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        title="Выше"
        aria-label="Выше"
      >
        <Icon name="up" />
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--sm"
        onClick={() => onMove(1)}
        disabled={index === length - 1}
        title="Ниже"
        aria-label="Ниже"
      >
        <Icon name="down" />
      </button>
      <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" onClick={onRemove} title="Удалить" aria-label="Удалить">
        <Icon name="trash" />
      </button>
    </div>
  );
}

const move = (list, index, delta) => {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
};

/*
 * onChange у ListField / TextListField / SchemaField приймає функцію-оновлювач
 * (prev → next): так зміни після асинхронних дій (конвертація картинки) не
 * перезаписують те, що користувач встиг змінити тим часом.
 */
const asList = (value) => (Array.isArray(value) ? value : []);

function ListField({ field, value, ctx, onChange }) {
  const list = asList(value);
  const update = (fn) => onChange((prev) => fn(asList(prev)));
  return (
    <div className="list-field">
      {list.map((entry, index) => (
        <div className={`list-item ${field.inline ? "list-item--inline" : ""}`} key={index}>
          <div className="list-item__head">
            <span className="list-item__num">{field.inline ? index + 1 : `${field.itemLabel || "Элемент"} ${index + 1}`}</span>
            <ListControls
              index={index}
              length={list.length}
              onMove={(delta) => update((prev) => move(prev, index, delta))}
              onRemove={() => {
                if (window.confirm(`Удалить «${field.itemLabel || "элемент"} ${index + 1}»?`)) {
                  update((prev) => prev.filter((_, i) => i !== index));
                }
              }}
            />
          </div>
          <div className={field.inline ? "list-item__row" : "list-item__body"}>
            {field.fields.map((sub) => (
              <SchemaField
                key={sub.key}
                field={sub}
                item={entry}
                ctx={ctx}
                onChange={(fn) => update((prev) => prev.map((x, i) => (i === index ? fn(x || {}) : x)))}
              />
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn btn--sm list-field__add" onClick={() => update((prev) => [...prev, emptyOf(field.fields)])}>
        <Icon name="plus" /> {field.itemLabel || "Добавить"}
      </button>
    </div>
  );
}

function TextListField({ field, value, ctx, onChange }) {
  const list = asList(value);
  const update = (fn) => onChange((prev) => fn(asList(prev)));
  return (
    <div className="list-field">
      {list.map((entry, index) => (
        <div className="text-list-item" key={index}>
          <LocalizedField
            field={{ type: "textarea", rows: 1 }}
            value={entry}
            lang={ctx.lang}
            onChange={(next) => update((prev) => prev.map((x, i) => (i === index ? next : x)))}
          />
          <ListControls
            index={index}
            length={list.length}
            onMove={(delta) => update((prev) => move(prev, index, delta))}
            onRemove={() => update((prev) => prev.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <button type="button" className="btn btn--sm list-field__add" onClick={() => update((prev) => [...prev, { uk: "" }])}>
        <Icon name="plus" /> {field.itemLabel || "Добавить"}
      </button>
    </div>
  );
}

/**
 * Одне поле схеми. item — об'єкт, у якому лежить поле (key може бути "a.b.c");
 * onChange(fn) — fn отримує актуальний item і повертає новий.
 */
export function SchemaField({ field, item, ctx, onChange }) {
  const path = splitKey(field.key);
  const value = getIn(item, path);
  const update = (fn) => onChange((prev) => setIn(prev, path, fn(getIn(prev, path))));
  const set = (next) => update(() => next);

  let control;
  switch (field.type) {
    case "text":
    case "textarea":
      control = (
        <LocalizedField
          field={field}
          value={isLocalized(value) || value == null ? value : { uk: String(value) }}
          lang={ctx.lang}
          onChange={set}
        />
      );
      break;
    case "plain":
      control = (
        <input
          className="input"
          value={value ?? ""}
          placeholder={field.placeholder || ""}
          onChange={(event) => set(event.target.value || undefined)}
        />
      );
      break;
    case "date":
      control = <input className="input" type="date" value={value ?? ""} onChange={(event) => set(event.target.value || undefined)} />;
      break;
    case "select":
      control = <SelectField field={field} value={value} onChange={set} />;
      break;
    case "color":
      control = <ColorField value={value} onChange={set} />;
      break;
    case "bool":
      return (
        <div className={`schema-field schema-field--bool ${field.half ? "schema-field--half" : ""}`}>
          <Toggle checked={value} onChange={(checked) => set(checked || undefined)} label={field.label} />
        </div>
      );
    case "image":
      control = (
        <ImageUpload
          value={value}
          uploads={ctx.uploads}
          onUpload={ctx.onUpload}
          preset={field.preset}
          onChange={(next, card) =>
            // разом з обкладинкою — картка 840×368 (field.autoCard)
            card ? onChange((prev) => setIn(setIn(prev, path, next), splitKey(field.autoCard), card)) : set(next)
          }
          extra={
            field.autoCard
              ? async (file) => {
                  const dataUrl = await convertImage(file, IMAGE_PRESETS.caseCard);
                  const key = uploadKey();
                  ctx.onUpload(key, dataUrl);
                  return `upload:${key}`;
                }
              : undefined
          }
        />
      );
      break;
    case "group":
      return (
        <fieldset className="schema-group">
          <legend>{field.label}</legend>
          {field.fields.map((sub) => (
            <SchemaField key={sub.key} field={sub} item={value || {}} ctx={ctx} onChange={(fn) => update((prev) => fn(prev || {}))} />
          ))}
        </fieldset>
      );
    case "list":
      control = <ListField field={field} value={value} ctx={ctx} onChange={update} />;
      break;
    case "textList":
      control = <TextListField field={field} value={value} ctx={ctx} onChange={update} />;
      break;
    default:
      control = <div className="faint">Неизвестный тип поля</div>;
  }

  return (
    <div className={`schema-field ${field.half ? "schema-field--half" : ""}`}>
      <div className="field__label">
        {field.label}
        {field.required && <span className="req"> *</span>}
      </div>
      {control}
      {field.hint && <div className="schema-field__hint">{field.hint}</div>}
    </div>
  );
}

/** Форма за схемою: секції, що згортаються */
export function SchemaForm({ schema, item, onChange, ctx, compact = false }) {
  // compact: відкрито лише перші дві секції (довгі кейси), решта — за кліком
  const [closed, setClosed] = useState(
    () => new Set(schema.filter((s, index) => s.collapsed || (compact && index >= 2)).map((s) => s.section)),
  );

  return schema.map((section) => {
    const isClosed = closed.has(section.section);
    return (
      <section className="form-section card" key={section.section}>
        <button
          type="button"
          className="form-section__head"
          onClick={() =>
            setClosed((prev) => {
              const next = new Set(prev);
              if (next.has(section.section)) next.delete(section.section);
              else next.add(section.section);
              return next;
            })
          }
        >
          <h2>{section.section}</h2>
          {section.hint && <span className="form-section__hint">{section.hint}</span>}
          <Icon name={isClosed ? "down" : "up"} />
        </button>
        {!isClosed && (
          <div className="form-section__body">
            {section.fields.map((field) => (
              <SchemaField key={field.key} field={field} item={item} ctx={ctx} onChange={onChange} />
            ))}
          </div>
        )}
      </section>
    );
  });
}
