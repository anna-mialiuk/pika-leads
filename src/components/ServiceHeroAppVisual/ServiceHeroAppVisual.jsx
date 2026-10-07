import { useLanguage } from "../../i18n";

import "./ServiceHeroAppVisual.sass";

function ServiceHeroAppVisual() {
  const { t } = useLanguage();

  return (
    <div className="service-hero-app">
      <div className="service-hero-app__glow" />

      <div className="service-hero-app__phone">
        <div className="service-hero-app__screen">
          <div className="service-hero-app__notch" />

          <div className="service-hero-app__status">
            <span>9:41</span>

            <span className="service-hero-app__battery" />
          </div>

          <div className="service-hero-app__header">
            <div className="service-hero-app__logo" />

            <div className="service-hero-app__header-lines">
              <span />
              <span />
            </div>

            <div className="service-hero-app__avatar" />
          </div>

          <div className="service-hero-app__banner">
            <span />
            <span />
            <span />

            <div className="service-hero-app__banner-button" />
          </div>

          <div className="service-hero-app__list">
            <div className="service-hero-app__row">
              <div className="service-hero-app__row-icon" />

              <div className="service-hero-app__row-lines">
                <span />
                <span />
              </div>

              <div className="service-hero-app__row-badge" />
            </div>

            <div className="service-hero-app__row">
              <div className="service-hero-app__row-icon" />

              <div className="service-hero-app__row-lines">
                <span />
                <span />
              </div>

              <div className="service-hero-app__row-badge service-hero-app__row-badge--secondary" />
            </div>
          </div>

          <div className="service-hero-app__nav">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      <div className="service-hero-app__metric service-hero-app__metric--rating">
        <span>{t("serviceVisuals.rating")}</span>
        <strong>4.9 ★</strong>
      </div>

      <div className="service-hero-app__metric service-hero-app__metric--installs">
        <span>{t("serviceVisuals.installs")}</span>
        <strong>50k+</strong>
      </div>
    </div>
  );
}

export default ServiceHeroAppVisual;
