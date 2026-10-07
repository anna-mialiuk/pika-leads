import Badge from "../../components/Badge/Badge";
import Icon from "../../components/Icon/Icon";

import "./ServiceSupport.sass";

function ServiceSupport({ data }) {
  if (!data) return null;

  const {
    badge,
    titleBefore,
    titleAccent,
    description,
    availability = "24/7",
    availabilityText,
    items = [],
  } = data;

  return (
    <section className="service-support">
      <div className="service-support__container">
        <div className="service-support__shell">
          <div className="service-support__decor service-support__decor--top" />
          <div className="service-support__decor service-support__decor--bottom" />

          <div className="service-support__grid">
            <div className="service-support__content">
              {badge && (
                <Badge className="service-support__badge" variant="service">
                  {badge}
                </Badge>
              )}

              <h2 className="service-support__title">
                {titleBefore}

                {titleAccent && (
                  <>
                    <br />
                    <span>{titleAccent}</span>
                  </>
                )}
              </h2>

              {description && (
                <p className="service-support__description">{description}</p>
              )}

              <div className="service-support__availability">
                <strong>{availability}</strong>
                {availabilityText && <span>{availabilityText}</span>}
              </div>
            </div>

            <div className="service-support__cards">
              {items.map((item) => (
                <article className="service-support__card" key={item.title}>
                  <div className="service-support__icon">
                    <Icon name={item.icon || "shield"} />
                  </div>

                  <div className="service-support__card-content">
                    <h3>{item.title}</h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ServiceSupport;
