import { LocalizedLink } from "../../i18n";

import Icon from "../../components/Icon/Icon";
import {
  CONSULTATION_HREF,
  useConsultation,
} from "../ConsultationModal/ConsultationContext";

import "./Button.sass";

function Button({
  children,
  href,
  variant = "primary",
  size = "large",
  arrow = false,
  className = "",
  type = "button",
  source,
  onClick,
  ...props
}) {
  const { open } = useConsultation();

  const classes = ["button", `button--${variant}`, `button--${size}`, className]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span>{children}</span>

      {arrow && <Icon name="arrow-right" className="button__icon" />}
    </>
  );

  // href="#consultation" — кнопка відкриває попап консультації
  if (href === CONSULTATION_HREF) {
    return (
      <button
        className={classes}
        type="button"
        onClick={(event) => {
          onClick?.(event);
          open(source);
        }}
        {...props}
      >
        {content}
      </button>
    );
  }

  if (href?.startsWith("/")) {
    return (
      <LocalizedLink className={classes} to={href} onClick={onClick} {...props}>
        {content}
      </LocalizedLink>
    );
  }

  if (href) {
    return (
      <a className={classes} href={href} onClick={onClick} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button className={classes} type={type} onClick={onClick} {...props}>
      {content}
    </button>
  );
}

export default Button;
