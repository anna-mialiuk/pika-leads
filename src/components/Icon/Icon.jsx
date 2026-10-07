import { icons } from "../../assets/icons";

import "./Icon.sass";

/**
 * Універсальна монохромна іконка з реєстру assets/icons.
 * Форма береться з SVG через CSS mask, колір — з CSS `color` батьківського
 * елемента (background-color: currentColor), тому один файл підходить
 * під будь-який колір. Розмір теж задається у стилях (.icon).
 */
function Icon({ name, src, className = "" }) {
  const url = src || icons[name];

  if (!url) return null;

  return (
    <span
      className={`icon ${className}`}
      style={{ "--icon": `url("${url}")` }}
      aria-hidden="true"
    />
  );
}

export default Icon;
