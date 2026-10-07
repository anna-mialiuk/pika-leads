import Icon from "../../components/Icon/Icon";
import "./PrincipleCard.sass";

function PrincipleCard({ number, type, icon, title, text }) {
  return (
    <article className={`principle-card principle-card--${type}`}>
      <span className="principle-card__number">{number}</span>

      <div className="principle-card__icon">
        <Icon name={icon} />
      </div>

      <div className="principle-card__content">
        <h3 className="principle-card__title">{title}</h3>

        <p className="principle-card__text">{text}</p>
      </div>
    </article>
  );
}

export default PrincipleCard;
