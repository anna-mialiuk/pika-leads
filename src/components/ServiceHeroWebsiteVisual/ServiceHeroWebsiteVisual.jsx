import Icon from "../../components/Icon/Icon";

import { useLanguage } from "../../i18n";

import "./ServiceHeroWebsiteVisual.sass";

function ServiceHeroWebsiteVisual() {
  const { t } = useLanguage();

  return (
    <div className="service-hero-website">
      <div className="service-hero-website__border" />

      <div className="service-hero-website__window">
        <div className="service-hero-website__top">
          <div className="service-hero-website__dots">
            <span />
            <span />
            <span />
          </div>

          <div className="service-hero-website__address">
            <Icon name="lock" />

            <span>yourbrand.com</span>
          </div>
        </div>

        <div className="service-hero-website__page">
          <div className="service-hero-website__nav">
            <div className="service-hero-website__logo" />

            <div className="service-hero-website__nav-lines">
              <span />
              <span />
              <span />
            </div>

            <div className="service-hero-website__nav-button" />
          </div>

          <div className="service-hero-website__heading">
            <span />
            <span />
          </div>

          <div className="service-hero-website__copy">
            <span />
            <span />
          </div>

          <div className="service-hero-website__actions">
            <span className="service-hero-website__primary" />
            <span className="service-hero-website__secondary" />
          </div>

          <div className="service-hero-website__cards">
            <div className="service-hero-website__card">
              <span className="service-hero-website__card-icon" />
              <span className="service-hero-website__card-line" />
            </div>

            <div className="service-hero-website__card">
              <span className="service-hero-website__card-icon" />
              <span className="service-hero-website__card-line" />
            </div>

            <div className="service-hero-website__card">
              <span className="service-hero-website__card-icon" />
              <span className="service-hero-website__card-line" />
            </div>
          </div>
        </div>
      </div>

      <div className="service-hero-website__metric service-hero-website__metric--pagespeed">
        <span>PageSpeed</span>
        <strong>98 / 100</strong>
      </div>

      <div className="service-hero-website__metric service-hero-website__metric--conversion">
        <span>{t("serviceVisuals.conversion")}</span>
        <strong>+32%</strong>
      </div>
    </div>
  );
}

export default ServiceHeroWebsiteVisual;
