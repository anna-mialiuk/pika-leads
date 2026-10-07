import Badge from "../../components/Badge/Badge";

import "./ServiceGuarantees.sass";

function ServiceGuarantees({ data }) {
  if (!data) return null;

  const { badge, titleBefore, titleAccent, description, items = [] } = data;

  return (
    <section className="service-guarantees">
      <div className="service-guarantees__container">
        <div className="service-guarantees__heading">
          <div className="service-guarantees__heading-main">
            <Badge className="service-guarantees__badge" variant="service">
              {badge}
            </Badge>

            <h2 className="service-guarantees__title">
              {titleBefore}
              <span>{titleAccent}</span>
            </h2>
          </div>

          <p className="service-guarantees__description">{description}</p>
        </div>

        <div className="service-guarantees__list">
          {items.map((item) => (
            <article className="service-guarantees__card" key={item.number}>
              <div className="service-guarantees__number">{item.number}</div>
              <h3 className="service-guarantees__card-title">{item.title}</h3>
              <p className="service-guarantees__card-text">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ServiceGuarantees;
