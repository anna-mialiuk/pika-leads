import { useRef, useState } from "react";

import Icon from "../Icon";
import { AutoTextarea, ImageUpload } from "./fields";
import { renderInline } from "../../lib/inline";
import { previewOf, slugify } from "../../lib/content";
import { t } from "../../lib/i18n";

/**
 * Редактор тексту статті блоками (формат src/content/blog/<мова>/<id>.json):
 *   heading { level 2|3, id?, text } · paragraph { text } · list { style, items[] }
 *   note { text, variant? } · code { code } · image { src, alt?, caption? }
 * У тексті дозволено <strong>, <em>, <a href>, <code>, <br> — кнопки над полем.
 */
const BLOCK_TYPES = [
  { type: "paragraph", label: t("Абзац"), icon: "text" },
  { type: "heading", label: t("Подзаголовок"), icon: "heading" },
  { type: "list", label: t("Список"), icon: "list" },
  { type: "note", label: t("Врезка"), icon: "note" },
  { type: "image", label: t("Картинка"), icon: "image" },
  { type: "code", label: t("Код"), icon: "code" },
];

const LABELS = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b.label]));

const newBlock = (type) =>
  ({
    paragraph: { type, text: "" },
    heading: { type, level: 2, text: "" },
    list: { type, style: "unordered", items: [""] },
    note: { type, text: "" },
    image: { type, src: "", alt: "", caption: "" },
    code: { type, code: "" },
  })[type];

/** Текст з кнопками форматування (обгортають виділений фрагмент) */
function RichText({ value, onChange, rows = 3, placeholder }) {
  const ref = useRef(null);
  const wrap = (before, after) => {
    const node = ref.current?.querySelector("textarea");
    if (!node) return;
    const { selectionStart: start, selectionEnd: end } = node;
    const selected = value.slice(start, end);
    onChange(value.slice(0, start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const link = () => {
    const url = window.prompt(t("Адрес ссылки (https://… или /blog/…)"), "https://");
    if (!url || url === "https://") return;
    if (!/^(https?:|mailto:|tel:|\/|#)/i.test(url)) {
      window.alert(t("Ссылка должна начинаться с https://, / или #"));
      return;
    }
    wrap(`<a href="${url.replace(/"/g, "%22")}">`, "</a>");
  };
  return (
    <div className="rich-text" ref={ref}>
      <div className="rich-text__bar">
        <button type="button" onClick={() => wrap("<strong>", "</strong>")} title={t("Жирный")}>
          <b>B</b>
        </button>
        <button type="button" onClick={() => wrap("<em>", "</em>")} title={t("Курсив")}>
          <i>I</i>
        </button>
        <button type="button" onClick={link} title={t("Ссылка")}>
          <Icon name="link" size={14} />
        </button>
        <button type="button" onClick={() => wrap("<code>", "</code>")} title={t("Код")}>
          <Icon name="code" size={14} />
        </button>
        <button type="button" onClick={() => wrap("<br>", "")} title={t("Перенос строки")}>
          ↵
        </button>
      </div>
      <AutoTextarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} />
    </div>
  );
}

function BlockBody({ block, onChange, uploads, onUpload }) {
  // onChange(fn): fn отримує актуальний блок (див. fields.jsx)
  const set = (patch) => onChange((current) => ({ ...current, ...patch }));
  switch (block.type) {
    case "heading":
      return (
        <div className="block-heading">
          <select className="select select--sm" value={block.level} onChange={(e) => set({ level: Number(e.target.value) })}>
            <option value={2}>{t("H2 — раздел")}</option>
            <option value={3}>{t("H3 — подраздел")}</option>
          </select>
          <input
            className="input block-heading__text"
            value={block.text}
            placeholder={t("Текст подзаголовка")}
            onChange={(e) => set({ text: e.target.value })}
            onBlur={() => block.level === 2 && !block.id && block.text && set({ id: slugify(block.text) })}
          />
          {block.level === 2 && (
            <label className="block-heading__anchor">
              <span>{t("Якорь для содержания")}</span>
              <input
                className="input input--sm mono"
                value={block.id || ""}
                placeholder="auto"
                onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") || undefined })}
              />
            </label>
          )}
        </div>
      );
    case "paragraph":
      return <RichText value={block.text} onChange={(text) => set({ text })} placeholder={t("Текст абзаца")} />;
    case "note":
      return (
        <>
          <select
            className="select select--sm block-note__variant"
            value={block.variant || ""}
            onChange={(e) => set({ variant: e.target.value || undefined })}
          >
            <option value="">{t("Обычная врезка")}</option>
            <option value="warning">{t("Предупреждение")}</option>
          </select>
          <RichText value={block.text} onChange={(text) => set({ text })} rows={2} placeholder={t("Текст врезки")} />
        </>
      );
    case "list":
      return (
        <>
          <select className="select select--sm block-note__variant" value={block.style} onChange={(e) => set({ style: e.target.value })}>
            <option value="unordered">{t("• Маркированный")}</option>
            <option value="ordered">{t("1. Нумерованный")}</option>
          </select>
          <div className="schema-field__hint">{t("Каждый пункт — с новой строки")}</div>
          <RichText
            value={block.items.join("\n")}
            onChange={(text) => set({ items: text.split("\n") })}
            rows={Math.max(2, block.items.length)}
            placeholder={t("Пункт 1\nПункт 2")}
          />
        </>
      );
    case "code":
      return <AutoTextarea className="textarea mono" value={block.code} onChange={(code) => set({ code })} rows={4} placeholder={t("Код")} />;
    case "image":
      return (
        <div className="block-image">
          <ImageUpload value={block.src} uploads={uploads} onUpload={onUpload} preset="blogBody" onChange={(src) => set({ src })} compact />
          <input
            className="input input--sm"
            value={block.alt || ""}
            placeholder={t("Описание для поисковиков (alt)")}
            onChange={(e) => set({ alt: e.target.value })}
          />
          <input
            className="input input--sm"
            value={block.caption || ""}
            placeholder={t("Подпись под картинкой")}
            onChange={(e) => set({ caption: e.target.value })}
          />
        </div>
      );
    default:
      return <div className="faint">{t("Неизвестный блок")}</div>;
  }
}

function AddBlock({ onAdd, open: initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen);
  if (!open) {
    return (
      <button type="button" className="add-block__toggle" onClick={() => setOpen(true)} title={t("Вставить блок")}>
        <Icon name="plus" size={14} />
      </button>
    );
  }
  return (
    <div className="add-block">
      {BLOCK_TYPES.map((b) => (
        <button
          type="button"
          key={b.type}
          className="btn btn--sm"
          onClick={() => {
            onAdd(newBlock(b.type));
            if (!initiallyOpen) setOpen(false);
          }}
        >
          <Icon name={b.icon} /> {b.label}
        </button>
      ))}
    </div>
  );
}

/** Попередній перегляд — так, як на сайті */
function Preview({ blocks, uploads }) {
  return (
    <div className="article-preview">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.level === 3 ? <h3 key={index}>{renderInline(block.text)}</h3> : <h2 key={index}>{renderInline(block.text)}</h2>;
          case "paragraph":
            return <p key={index}>{renderInline(block.text)}</p>;
          case "list": {
            const Tag = block.style === "ordered" ? "ol" : "ul";
            return (
              <Tag key={index}>
                {block.items.filter(Boolean).map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </Tag>
            );
          }
          case "note":
            return (
              <div key={index} className={`article-preview__note ${block.variant === "warning" ? "is-warning" : ""}`}>
                {renderInline(block.text)}
              </div>
            );
          case "code":
            return <pre key={index}>{block.code}</pre>;
          case "image":
            return (
              <figure key={index}>
                {block.src && <img src={previewOf(block.src, uploads)} alt={block.alt || ""} />}
                {block.caption && <figcaption>{renderInline(block.caption)}</figcaption>}
              </figure>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function BlockEditor({ blocks, onChange, uploads, onUpload }) {
  const [preview, setPreview] = useState(false);
  // onChange(fn): fn отримує актуальний список блоків
  const update = (index, fn) => onChange((prev) => prev.map((b, i) => (i === index ? fn(b) : b)));
  const insert = (index, block) => onChange((prev) => [...prev.slice(0, index), block, ...prev.slice(index)]);
  const moveBlock = (index, delta) =>
    onChange((prev) => {
      const next = [...prev];
      const [block] = next.splice(index, 1);
      next.splice(index + delta, 0, block);
      return next;
    });

  return (
    <div className="block-editor">
      <div className="block-editor__mode segmented">
        <button type="button" className={!preview ? "is-active" : ""} onClick={() => setPreview(false)}>{t("Редактор")}</button>
        <button type="button" className={preview ? "is-active" : ""} onClick={() => setPreview(true)}>{t("Предпросмотр")}</button>
      </div>

      {preview ? (
        <Preview blocks={blocks} uploads={uploads} />
      ) : (
        <>
          {blocks.map((block, index) => (
            <div key={index} className="block-editor__item">
              <AddBlock onAdd={(b) => insert(index, b)} />
              <div className={`block block--${block.type}`}>
                <div className="block__head">
                  <span className="block__type">
                    {LABELS[block.type] || block.type}
                    {block.type === "heading" ? ` H${block.level}` : ""}
                  </span>
                  <div className="list-item__controls">
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={() => moveBlock(index, -1)}
                      disabled={index === 0}
                      aria-label={t("Выше")}
                    >
                      <Icon name="up" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={() => moveBlock(index, 1)}
                      disabled={index === blocks.length - 1}
                      aria-label={t("Ниже")}
                    >
                      <Icon name="down" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm icon-btn--danger"
                      aria-label={t("Удалить блок")}
                      onClick={() => {
                        const empty = !(block.text || block.code || block.src || block.items?.some(Boolean));
                        if (empty || window.confirm(t("Удалить блок?"))) onChange((prev) => prev.filter((_, i) => i !== index));
                      }}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
                <BlockBody block={block} onChange={(fn) => update(index, fn)} uploads={uploads} onUpload={onUpload} />
              </div>
            </div>
          ))}
          <div className="block-editor__end">
            <div className="field__label">{t("Добавить в конец")}</div>
            <AddBlock onAdd={(b) => insert(blocks.length, b)} open />
          </div>
        </>
      )}
    </div>
  );
}

export default BlockEditor;
