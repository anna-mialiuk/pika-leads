import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";
import Icon from "../../components/Icon/Icon";

import ServiceHeroAdVisual from "./ServiceHeroAdVisual";
import ServiceHeroAppVisual from "../../components/ServiceHeroAppVisual/ServiceHeroAppVisual";
import ServiceHeroWebsiteVisual from "../../components/ServiceHeroWebsiteVisual/ServiceHeroWebsiteVisual";
import ServiceHeroUiuxVisual from "../../components/ServiceHeroUiuxVisual/ServiceHeroUiuxVisual";
import ServiceHeroCreativeVisual from "../../components/ServiceHeroCreativeVisual/ServiceHeroCreativeVisual";
import ServiceHeroSmmVisual from "../../components/ServiceHeroSmmVisual/ServiceHeroSmmVisual";

import "./ServiceHero.sass";

const visuals = {
  app: ServiceHeroAppVisual,
  website: ServiceHeroWebsiteVisual,
  uiux: ServiceHeroUiuxVisual,
  creative: ServiceHeroCreativeVisual,
  smm: ServiceHeroSmmVisual,
};

function ServiceHero({ data, type = "meta" }) {
  if (!data) return null;

  const {
    badge,
    titleBefore,
    titleAccent,
    titleAfter,
    description,
    sponsoredText = "Sponsored · Instagram",
    primaryButton,
    secondaryButton,
    stats = [],
    triggers = [],
    visualType,
  } = data;

  const Visual = visuals[visualType];

  return (
    <section className={`service-hero service-hero--${type}`}>
      <div className="service-hero__decor service-hero__decor--dots" />
      <div className="service-hero__decor service-hero__decor--blue" />
      <div className="service-hero__decor service-hero__decor--instagram" />

      <div className="service-hero__container">
        <div className="service-hero__content">
          {badge && (
            <Badge className="service-hero__badge" variant="service">
              {badge}
            </Badge>
          )}

          <h1 className="service-hero__title">
            {titleBefore}{" "}
            {titleAccent && (
              <span className="service-hero__title-accent">{titleAccent}</span>
            )}
            {titleAfter && (
              <>
                <br />
                {titleAfter}
              </>
            )}
          </h1>

          {description && (
            <p className="service-hero__description">{description}</p>
          )}

          {(primaryButton?.href || secondaryButton?.href) && (
            <div className="service-hero__actions">
              {primaryButton?.href && (
                <Button href={primaryButton.href}>{primaryButton.text}</Button>
              )}

              {secondaryButton?.href && (
                <Button
                  className="service-hero__button--secondary"
                  href={secondaryButton.href}
                  variant="secondary"
                >
                  {secondaryButton.text}
                </Button>
              )}
            </div>
          )}

          {triggers.length > 0 && (
            <div className="service-hero__triggers">
              {triggers.map((trigger) => (
                <div className="service-hero__trigger" key={trigger.text}>
                  <span className="service-hero__trigger-icon">
                    <Icon name={trigger.icon} />
                  </span>

                  <span>{trigger.text}</span>
                </div>
              ))}
            </div>
          )}

          {triggers.length === 0 && stats.length > 0 && (
            <div className="service-hero__stats">
              {stats.map((stat) => (
                <div className="service-hero__stat" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="service-hero__visual">
          {Visual ? (
            <Visual />
          ) : (
            <ServiceHeroAdVisual
              sponsoredText={sponsoredText}
              isGoogle={type === "google"}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export default ServiceHero;
