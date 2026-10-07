import Button from "../../components/Button/Button";

import pikaHero from "../../assets/images/pika-hero.webp";

import Icon from "../../components/Icon/Icon";

import { useLanguage, useData } from "../../i18n";

import "./Hero.sass";

function Hero() {
  const { t } = useLanguage();
  const { heroMetrics, heroStats, heroTags } = useData("heroData");

  return (
    <section className="hero">
      <div className="hero__grid" />

      <div className="hero__container">
        <div className="hero__content">
          <div className="hero__tags">
            {heroTags.map((tag) => (
              <span className="hero__tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <h1 className="hero__title">
            {t("hero.titleLine1")}
            <span>{t("hero.titleAccent")}</span>
          </h1>

          <p className="hero__text">{t("hero.text")}</p>

          <div className="hero__buttons">
            <Button
              href="#consultation"
              source="hero"
              variant="primary"
              size="large"
              arrow
            >
              {t("common.getConsultation")}
            </Button>

            <Button href="#cases" variant="secondary" size="large">
              {t("hero.viewCases")}
            </Button>
          </div>

          <div className="hero__stats">
            {heroStats.map((stat) => (
              <div className="hero__stat" key={stat.type}>
                <div className="hero__stat-icon">
                  <Icon name={stat.icon} />
                </div>

                <div className="hero__stat-content">
                  <strong className="hero__stat-value">{stat.value}</strong>
                  <span className="hero__stat-label">{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__glow" />

          <img className="hero__image" src={pikaHero} alt="Pika Leads" />

          {heroMetrics.map((metric) => (
            <div
              className={`hero__metric hero__metric--${metric.type}`}
              key={metric.type}
            >
              <div
                className={`hero__metric-icon hero__metric-icon--${metric.type}`}
              >
                <Icon name={metric.icon} />
              </div>

              <div className="hero__metric-content">
                <strong className="hero__metric-value">
                  {metric.value}

                  {metric.suffix && (
                    <span className="hero__metric-suffix">{metric.suffix}</span>
                  )}
                </strong>

                <span className="hero__metric-label">{metric.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Hero;
