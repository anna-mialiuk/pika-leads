import ServiceCard from "../../components/ServiceCard/ServiceCard";
import { useLanguage, useData } from "../../i18n";
import Badge from "../../components/Badge/Badge";

import "./Services.sass";

function Services() {
  const { t } = useLanguage();
  const { services } = useData("servicesData");

  return (
    <section className="services" id="services">
      <div className="services__container">
        <Badge className="services__badge">{t("services.badge")}</Badge>

        <div className="services__heading">
          <h2 className="services__title">
            {t("services.titleLine1")}
            <span>{t("services.titleAccent")}</span>
          </h2>

          <p className="services__description">{t("services.description")}</p>
        </div>

        <div className="services__list">
          {services.map((service) => (
            <ServiceCard key={service.id} {...service} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Services;
