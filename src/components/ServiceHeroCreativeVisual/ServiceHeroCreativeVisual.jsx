import { useLanguage } from "../../i18n";

import "./ServiceHeroCreativeVisual.sass";

function ServiceHeroCreativeVisual() {
  const { t } = useLanguage();

  return (
    <div className="creative-visual">
      <div className="creative-visual__glow" />

      <div className="creative-visual__board">
        <div className="creative-visual__video">
          <div className="creative-visual__video-pattern" />

          <div className="creative-visual__play">
            <span />
          </div>

          <strong>VIDEO · 0:15</strong>
        </div>

        <div className="creative-visual__small creative-visual__small--story">
          <div className="creative-visual__story-icon" />

          <div className="creative-visual__lines">
            <span />
            <span />
          </div>

          <strong>STORY</strong>
        </div>

        <div className="creative-visual__small creative-visual__small--banner">
          <div className="creative-visual__banner-lines">
            <span />
            <span />
            <span />
          </div>

          <strong>{t("serviceVisuals.banner")}</strong>
        </div>

        <div className="creative-visual__footer">
          <div className="creative-visual__footer-icon" />

          <div className="creative-visual__footer-lines">
            <span />
            <span />
          </div>

          <div className="creative-visual__dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      <div className="creative-visual__metric creative-visual__metric--ctr">
        <span>CTR</span>
        <strong>×2.4</strong>
      </div>

      <div className="creative-visual__metric creative-visual__metric--formats">
        <span>{t("serviceVisuals.formats")}</span>
        <strong>15+</strong>
      </div>
    </div>
  );
}

export default ServiceHeroCreativeVisual;
