import { LocalizedLink } from "../../i18n";

import { CONSULTATION_HREF, useConsultation } from "./ConsultationContext";

/**
 * Посилання-CTA: якщо href="#consultation" — кнопка, що відкриває попап,
 * інакше — звичайне локалізоване посилання.
 */
function ConsultationTrigger({ href, className, children, source, onClick }) {
  const { open } = useConsultation();

  if (href === CONSULTATION_HREF) {
    return (
      <button
        className={className}
        type="button"
        onClick={(event) => {
          onClick?.(event);
          open(source);
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <LocalizedLink className={className} to={href} onClick={onClick}>
      {children}
    </LocalizedLink>
  );
}

export default ConsultationTrigger;
