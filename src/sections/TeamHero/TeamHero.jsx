import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";

import founderImage from "../../assets/images/team/founder.webp";

import { useLanguage } from "../../i18n";

import "./TeamHero.sass";

function TeamHero() {
  const { t } = useLanguage();

  return (
    <section className="team-hero">
      <div className="team-hero__container">
        <div className="team-hero__media">
          <img
            className="team-hero__image"
            src={founderImage}
            alt={t("teamPage.founderAlt")}
          />
        </div>

        <div className="team-hero__content">
          <Badge className="team-hero__badge">{t("teamPage.badge")}</Badge>

          <h1 className="team-hero__title">{t("teamPage.name")}</h1>

          <div className="team-hero__position">{t("teamPage.position")}</div>

          <div className="team-hero__description">
            {t("teamPage.bio").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="team-hero__skills">
            <span className="team-hero__skills-title">
              {t("teamPage.skillsTitle")}
            </span>

            <ul>
              {t("teamPage.skills").map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </div>

          <div className="team-hero__actions">
            <Button href="#consultation" source="team">
              {t("teamPage.contactTeam")}
            </Button>

            <Button href="/cases" variant="secondary">
              {t("teamPage.ourCases")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TeamHero;
