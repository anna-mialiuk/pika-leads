import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { getInitials } from "./initials";
import { useLanguage } from "../../i18n";

import "./TeamMemberModal.sass";

const FOCUSABLE =
  'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Повний профіль учасника команди */
function TeamMemberModal({ member, onClose }) {
  const { t } = useLanguage();
  const titleId = useId();
  const dialogRef = useRef(null);
  const triggerRef = useRef(document.activeElement);

  const {
    name,
    position,
    bio,
    image,
    experience = [],
    skillsTitle,
    skills = [],
    education = [],
  } = member;

  useEffect(() => {
    const trigger = triggerRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    dialogRef.current?.querySelector(".team-member-modal__close")?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const elements = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="team-member-modal"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="team-member-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <button
          className="team-member-modal__close"
          type="button"
          onClick={onClose}
          aria-label={t("consultation.close")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <header className="team-member-modal__header">
          <div className="team-member-modal__avatar">
            {image ? (
              <img src={image} alt="" />
            ) : (
              <span aria-hidden="true">{getInitials(name)}</span>
            )}
          </div>

          <div>
            <h2 className="team-member-modal__name" id={titleId}>
              {name}
            </h2>
            <div className="team-member-modal__position">{position}</div>
          </div>
        </header>

        {bio && <p className="team-member-modal__bio">{bio}</p>}

        {experience.length > 0 && (
          <section className="team-member-modal__section">
            <h3>{t("team.experience")}</h3>

            <ul className="team-member-modal__timeline">
              {experience.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  {item.note && <span>{item.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {skills.length > 0 && (
          <section className="team-member-modal__section">
            <h3>{skillsTitle || t("team.skills")}</h3>

            <ul className="team-member-modal__skills">
              {skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </section>
        )}

        {education.length > 0 && (
          <section className="team-member-modal__section">
            <h3>{t("team.education")}</h3>

            <ul className="team-member-modal__timeline">
              {education.map((item) => (
                <li key={item.id}>
                  <strong>
                    {item.title}
                    {item.year && <em>{item.year}</em>}
                  </strong>
                  {item.note && <span>{item.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default TeamMemberModal;
