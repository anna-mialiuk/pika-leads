import { LocalizedLink as Link, useLanguage } from "../../i18n";

import Button from "../../components/Button/Button";
import Icon from "../../components/Icon/Icon";

import "./ServiceSingle.sass";

function ServiceSingle({ data }) {
  const { t } = useLanguage();

  if (!data) return null;

  const {
    title,
    description,
    icon,
    buttonText = t("serviceSingle.button"),
    buttonHref = "#consultation",
  } = data;

  return (
    <section className="service-single">
      <div className="service-single__container">
        <Link to="/#services" className="service-single__back">
          {t("serviceSingle.back")}
        </Link>

        {icon && (
          <div className="service-single__icon">
            <Icon name={icon} />
          </div>
        )}

        <h1 className="service-single__title">{title}</h1>

        <p className="service-single__description">{description}</p>

        <Button
          className="service-single__button"
          href={buttonHref}
          source="service"
        >
          {buttonText}
        </Button>
      </div>
    </section>
  );
}

export default ServiceSingle;
