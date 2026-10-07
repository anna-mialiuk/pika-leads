import Badge from "../../components/Badge/Badge";
import Icon from "../../components/Icon/Icon";

import "./ServiceScope.sass";

function ServiceScope({ data }) {
  if (!data) return null;

  const {
    badge,
    titleBefore,
    titleAccent,
    description,
    items = [],
    notes = [],
  } = data;

  return (
    <section className="service-scope">
      <div className="service-scope__container">
        <div className="service-scope__header">
          <div className="service-scope__heading">
            {badge && (
              <Badge className="service-scope__badge" variant="service">
                {badge}
              </Badge>
            )}

            <h2 className="service-scope__title">
              {titleBefore}

              {titleAccent && (
                <>
                  <br />
                  <span>{titleAccent}</span>
                </>
              )}
            </h2>
          </div>

          {description && (
            <p className="service-scope__description">{description}</p>
          )}
        </div>

        <div className="service-scope__grid">
          {items.map((item) => (
            <article className="service-scope__card" key={item.title}>
              {item.icon && (
                <div className="service-scope__icon">
                  <Icon name={item.icon} />
                </div>
              )}

              <h3 className="service-scope__card-title">{item.title}</h3>

              <p className="service-scope__card-description">
                {item.description}
              </p>
            </article>
          ))}
        </div>

        {notes.length > 0 && (
          <div className="service-scope__notes">
            {notes.map((note) => (
              <div className="service-scope__note" key={note}>
                <span className="service-scope__note-icon">
                  <Icon name="check" />
                </span>

                <span>{note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default ServiceScope;
