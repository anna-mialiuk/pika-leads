import Button from "../../components/Button/Button";
import Badge from "../../components/Badge/Badge";

import aboutTeam from "../../assets/images/about/about-team.webp";
import aboutOffice from "../../assets/images/about/about-office.webp";

import { useLanguage } from "../../i18n";

import "./About.sass";

function About() {
  const { t } = useLanguage();

  return (
    <section className="about" id="about">
      <div className="about__container">
        <div className="about__content">
          <Badge className="about__label">{t("about.badge")}</Badge>

          <h2 className="about__title">
            {t("about.titleLine1")}
            <br />
            {t("about.titleLine2")}
            <span>{t("about.titleAccent1")}</span>
            <br />
            <span>{t("about.titleAccent2")}</span>
          </h2>

          <p className="about__lead">{t("about.lead")}</p>

          <div className="about__text">
            <p>{t("about.text1")}</p>

            <p>
              {t("about.text2Before")}
              <strong>{t("about.text2Strong")}</strong>
              {t("about.text2After")}
            </p>
          </div>

          <div className="about__buttons">
            <Button href="/team" variant="primary" size="large" arrow>
              {t("about.whoWeAre")}
            </Button>

            <Button
              href="#consultation"
              source="about"
              variant="secondary"
              size="large"
            >
              {t("about.contact")}
            </Button>
          </div>
        </div>

        <div className="about__visual">
          <div className="about__team">
            <img
              className="about__team-image"
              src={aboutTeam}
              alt={t("about.teamAlt")}
            />
          </div>

          <div className="about__bottom">
            <div className="about__office">
              <img
                className="about__office-image"
                src={aboutOffice}
                alt={t("about.officeAlt")}
              />
            </div>

            <div className="about__experience">
              <strong>10+</strong>
              <span>{t("about.experience")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default About;
