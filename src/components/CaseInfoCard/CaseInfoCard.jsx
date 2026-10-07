import "./CaseInfoCard.sass";

function CaseInfoCard({
  title,
  items = [],
  description,
  note,
  variant = "yellow",
}) {
  if (!title) return null;

  return (
    <div className={`case-info-card case-info-card--${variant}`}>
      <h3 className="case-info-card__title">{title}</h3>

      {description && (
        <p className="case-info-card__description">{description}</p>
      )}

      {items.length > 0 && (
        <div className="case-info-card__items">
          {items.map((item, index) => (
            <div
              className="case-info-card__item"
              key={`${item.label}-${index}`}
            >
              <span className="case-info-card__label">{item.label}</span>

              <strong
                className={`case-info-card__value ${
                  item.type ? `case-info-card__value--${item.type}` : ""
                }`}
              >
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      )}

      {note && <p className="case-info-card__note">{note}</p>}
    </div>
  );
}

export default CaseInfoCard;
