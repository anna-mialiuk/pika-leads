import Icon from "../../components/Icon/Icon";
import { useLanguage } from "../../i18n";

/** Макет рекламного поста (Instagram / Google) у hero сторінок трафіку */
function ServiceHeroAdVisual({ sponsoredText, isGoogle }) {
  const { t } = useLanguage();

  return (
    <div className="service-hero__instagram">
      <div className="service-hero__instagram-border" />

      <div className="service-hero__instagram-card">
        <div className="service-hero__instagram-header">
          <div className="service-hero__avatar" />

          <div className="service-hero__instagram-user">
            <strong>your_brand</strong>
            <span>{sponsoredText}</span>
          </div>

          <span className="service-hero__instagram-more">···</span>
        </div>

        <div className="service-hero__creative">
          <div className="service-hero__creative-pattern" />

          <div className="service-hero__creative-content">
            <strong>
              {t("serviceHero.yourCreative")}
              <br />
              {t("serviceHero.creative")}
            </strong>

            <span>{t("serviceHero.leaveRequest")}</span>
          </div>
        </div>

        {!isGoogle && (
          <div className="service-hero__instagram-actions">
            <Icon
              name="heart"
              className="service-hero__instagram-action--heart"
            />
            <Icon name="comment" />
            <Icon name="send" />
          </div>
        )}

        <div className="service-hero__instagram-info">
          <strong>
            {isGoogle ? t("serviceHero.googleAd") : t("serviceHero.likes")}
          </strong>
          <span>{t("serviceHero.dailyLeads")}</span>
        </div>
      </div>

      <div className="service-hero__metric service-hero__metric--cpl">
        <span>CPL</span>
        <strong>↓ 43%</strong>
      </div>

      <div className="service-hero__metric service-hero__metric--roas">
        <span>ROAS</span>
        <strong>5.8x</strong>
      </div>
    </div>
  );
}

export default ServiceHeroAdVisual;
