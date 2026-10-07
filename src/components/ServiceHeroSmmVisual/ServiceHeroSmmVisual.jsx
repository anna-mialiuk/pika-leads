import { useLanguage } from "../../i18n";

import "./ServiceHeroSmmVisual.sass";

function ServiceHeroSmmVisual() {
  const { t } = useLanguage();

  return (
    <div className="smm-visual">
      <div className="smm-visual__glow" />

      <div className="smm-visual__profile">
        <div className="smm-visual__header">
          <div className="smm-visual__avatar">
            <div className="smm-visual__avatar-inner" />
          </div>

          <div className="smm-visual__stats">
            <div className="smm-visual__stat">
              <strong>128</strong>
              <span>{t("serviceVisuals.posts")}</span>
            </div>

            <div className="smm-visual__stat">
              <strong>24.5k</strong>
              <span>{t("serviceVisuals.followers")}</span>
            </div>

            <div className="smm-visual__stat">
              <strong>312</strong>
              <span>{t("serviceVisuals.following")}</span>
            </div>
          </div>
        </div>

        <div className="smm-visual__bio">
          <span />
          <span />
          <span />
        </div>

        <div className="smm-visual__actions">
          <div className="smm-visual__follow">{t("serviceVisuals.follow")}</div>

          <div className="smm-visual__message">
            {t("serviceVisuals.message")}
          </div>
        </div>

        <div className="smm-visual__grid">
          <div className="smm-visual__post smm-visual__post--gradient" />
          <div className="smm-visual__post smm-visual__post--dark" />

          <div className="smm-visual__post smm-visual__post--video">
            <span />
          </div>

          <div className="smm-visual__post smm-visual__post--dark" />
          <div className="smm-visual__post smm-visual__post--pink" />
          <div className="smm-visual__post smm-visual__post--dark-light" />
        </div>
      </div>

      <div className="smm-visual__metric smm-visual__metric--reach">
        <span>{t("serviceVisuals.reach")}</span>
        <strong>+240%</strong>
      </div>

      <div className="smm-visual__metric smm-visual__metric--followers">
        <span>{t("serviceVisuals.followersMetric")}</span>
        <strong>+5.2k</strong>
      </div>
    </div>
  );
}

export default ServiceHeroSmmVisual;
