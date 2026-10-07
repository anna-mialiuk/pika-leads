import Icon from "../../components/Icon/Icon";
import "./FeatureCard.sass";

function FeatureCard({ icon, type, title, text, value, variant = "default" }) {
  return (
    <article
      className={`feature-card feature-card--${type} feature-card--${variant}`}
    >
      <div className="feature-card__icon">
        <Icon name={icon} />
      </div>

      {value && <strong className="feature-card__value">{value}</strong>}

      <h3 className="feature-card__title">{title}</h3>

      <p className="feature-card__text">{text}</p>
    </article>
  );
}

export default FeatureCard;
