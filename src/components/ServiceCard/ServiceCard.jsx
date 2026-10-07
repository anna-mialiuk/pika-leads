import { LocalizedLink as Link, useLanguage } from "../../i18n";

import Icon from "../../components/Icon/Icon";

import "./ServiceCard.sass";

function ServiceCard({ number, type, icon, title, text, href }) {
  const { t } = useLanguage();

  return (
    <article className={`service-card service-card--${type}`}>
      <span className="service-card__number">{number}</span>

      <div className="service-card__icon">
        <Icon name={icon} />
      </div>

      <h3 className="service-card__title">{title}</h3>

      <p className="service-card__text">{text}</p>

      <Link
        className={`service-card__link service-card__link--${type}`}
        to={href}
      >
        <span>{t("common.learnMore")}</span>
        <span>→</span>
      </Link>
    </article>
  );
}

export default ServiceCard;
