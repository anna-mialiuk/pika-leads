import { useState } from "react";

import TeamMemberModal from "../TeamMemberModal/TeamMemberModal";
import { getInitials } from "../TeamMemberModal/initials";
import { useLanguage } from "../../i18n";

import "./TeamCard.sass";

function TeamCard(member) {
  const { name, position, description, image } = member;
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article className="team-card">
      <div className="team-card__media">
        {image ? (
          <img
            className="team-card__image"
            src={image}
            alt={name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="team-card__placeholder" aria-hidden="true">
            <span>{getInitials(name)}</span>
          </div>
        )}
      </div>

      <div className="team-card__content">
        <h3 className="team-card__name">{name}</h3>

        <div className="team-card__position">{position}</div>

        <p className="team-card__description">{description}</p>

        <button
          className="team-card__link"
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
        >
          {t("common.learnMore")}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {isOpen && (
        <TeamMemberModal member={member} onClose={() => setIsOpen(false)} />
      )}
    </article>
  );
}

export default TeamCard;
