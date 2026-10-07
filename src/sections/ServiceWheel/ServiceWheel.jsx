import Badge from "../../components/Badge/Badge";
import Icon from "../../components/Icon/Icon";
import ServiceWheelForm from "../../components/ServiceWheelForm/ServiceWheelForm";
import WheelConfetti from "../../components/WheelConfetti/WheelConfetti";
import WheelGraphic from "./WheelGraphic";

import { useWheel } from "../../hooks/useWheel";

import { useLanguage, useData } from "../../i18n";

import "./ServiceWheel.sass";

function ServiceWheel() {
  const { t } = useLanguage();
  const { serviceWheelBenefits, serviceWheelPrizes } =
    useData("serviceWheelData");

  const {
    rotation,
    isSpinning,
    hasSpun,
    prize,
    isClaimed,
    showConfetti,
    spin,
    claim,
  } = useWheel(serviceWheelPrizes);

  const hubLabel = isSpinning ? "···" : hasSpun ? "🎁" : "SPIN";

  return (
    <section className="service-wheel">
      <div className="service-wheel__container">
        <WheelConfetti active={showConfetti} />

        <div className="service-wheel__visual">
          <div className="service-wheel__wheel-wrap">
            <div className="service-wheel__glow" />

            <div className="service-wheel__pointer">
              <span />
            </div>

            <div
              className="service-wheel__wheel"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <WheelGraphic prizes={serviceWheelPrizes} />
            </div>

            <button
              className="service-wheel__hub"
              type="button"
              disabled={hasSpun}
              onClick={spin}
            >
              {hubLabel}
            </button>
          </div>

          {!hasSpun && (
            <div className="service-wheel__spin-wrap">
              <button
                className="service-wheel__spin"
                type="button"
                onClick={spin}
              >
                <Icon name="refresh" className="service-wheel__spin-icon" />
                <span>{t("serviceWheel.spin")}</span>
              </button>

              <div className="service-wheel__attempt">
                <Icon
                  name="lightning"
                  className="service-wheel__attempt-icon"
                />
                <span>{t("serviceWheel.oneAttempt")}</span>
              </div>
            </div>
          )}
        </div>

        <div className="service-wheel__content">
          {!prize && !isClaimed && (
            <>
              <Badge className="service-wheel__badge">
                {t("serviceWheel.badge")}
              </Badge>

              <h2 className="service-wheel__title">
                {t("serviceWheel.titleLine1")}
                <br />
                {t("serviceWheel.titleLine2")}
                <span>{t("serviceWheel.titleAccent")}</span>
              </h2>

              <p className="service-wheel__description">
                {t("serviceWheel.description")}
              </p>

              <div className="service-wheel__benefits">
                {serviceWheelBenefits.map((benefit) => (
                  <div className="service-wheel__benefit" key={benefit}>
                    <span className="service-wheel__benefit-icon">
                      <Icon name="check" />
                    </span>

                    <span>{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="service-wheel__available">
                <Icon name="clock" className="service-wheel__available-icon" />
                <span>{t("serviceWheel.availableBefore")}</span>
                <strong>7</strong>
                <span>{t("serviceWheel.availableAfter")}</span>
              </div>
            </>
          )}

          {prize && !isClaimed && (
            <div className="service-wheel__win">
              <Badge
                className="service-wheel__badge"
                variant="success"
                icon="check"
              >
                {t("serviceWheel.yourBonus")}
              </Badge>

              <h2 className="service-wheel__prize-title">{prize.label}</h2>

              <p className="service-wheel__prize-description">
                {prize.description}
                {t("serviceWheel.prizeSuffix")}
              </p>

              <ServiceWheelForm prize={prize.label} onSuccess={claim} />
            </div>
          )}

          {isClaimed && (
            <div className="service-wheel__success">
              <div className="service-wheel__success-icon">
                <Icon name="check" />
              </div>

              <h2>
                {t("serviceWheel.successLine1")}
                <br />
                {t("serviceWheel.successLine2")}
              </h2>

              <p>
                {t("serviceWheel.successBefore")}
                <strong>«{prize?.label}»</strong>
                {t("serviceWheel.successAfter")}
              </p>

              <div className="service-wheel__success-label">
                <Icon name="check" />
                <span>{t("serviceWheel.accepted")}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ServiceWheel;
