import Icon from "../Icon/Icon";

import "./Badge.sass";

/**
 * Бейдж-«таблетка» з крапкою перед текстом.
 * variant="primary" — жовтий (головна сторінка), "service" — колір теми сторінки послуги.
 */
function Badge({ children, variant = "primary", className = "", icon }) {
  const classes = ["badge", `badge--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      {icon ? (
        <Icon name={icon} className="badge__icon" />
      ) : (
        <span className="badge__dot" />
      )}

      <span>{children}</span>
    </div>
  );
}

export default Badge;
