import { useLanguage } from "../../i18n";

import "./ServiceHeroUiuxVisual.sass";

function ServiceHeroUiuxVisual() {
  const { t } = useLanguage();

  return (
    <div className="service-hero-uiux">
      <div className="service-hero-uiux__border" />

      <div className="service-hero-uiux__window">
        <div className="service-hero-uiux__toolbar">
          <div className="service-hero-uiux__toolbar-dots">
            <span />
            <span />
            <span />
          </div>

          <div className="service-hero-uiux__toolbar-line" />

          <div className="service-hero-uiux__toolbar-actions">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="service-hero-uiux__workspace">
          <aside className="service-hero-uiux__sidebar">
            <span className="service-hero-uiux__sidebar-active" />
            <span />
            <span />
            <span />
            <span />
          </aside>

          <div className="service-hero-uiux__canvas">
            <div className="service-hero-uiux__artboard">
              <div className="service-hero-uiux__selection" />

              <span className="service-hero-uiux__handle service-hero-uiux__handle--tl" />
              <span className="service-hero-uiux__handle service-hero-uiux__handle--tr" />
              <span className="service-hero-uiux__handle service-hero-uiux__handle--bl" />
              <span className="service-hero-uiux__handle service-hero-uiux__handle--br" />

              <div className="service-hero-uiux__artboard-hero" />

              <div className="service-hero-uiux__artboard-title" />

              <div className="service-hero-uiux__artboard-copy">
                <span />
                <span />
              </div>

              <div className="service-hero-uiux__artboard-actions">
                <span className="service-hero-uiux__artboard-primary" />
                <span className="service-hero-uiux__artboard-secondary" />
              </div>
            </div>

            <div className="service-hero-uiux__palette">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>

      <div className="service-hero-uiux__metric service-hero-uiux__metric--components">
        <span>{t("serviceVisuals.components")}</span>
        <strong>120+</strong>
      </div>

      <div className="service-hero-uiux__metric service-hero-uiux__metric--prototype">
        <span>{t("serviceVisuals.prototype")}</span>
        <strong>{t("serviceVisuals.interactive")}</strong>
      </div>
    </div>
  );
}

export default ServiceHeroUiuxVisual;
