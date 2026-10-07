import { clients } from "../../data/clientsData";
import Badge from "../../components/Badge/Badge";
import { useLanguage } from "../../i18n";

import "./ServiceClients.sass";

function ServiceClients() {
  const { t } = useLanguage();

  const clientsLoop = [...clients, ...clients];

  return (
    <section className="service-clients">
      <div className="service-clients__container">
        <Badge className="service-clients__badge" variant="service">
          {t("serviceClients.badge")}
        </Badge>

        <h2 className="service-clients__title">
          {t("serviceClients.titleStart")}
          <span>{t("serviceClients.titleAccent")}</span>
        </h2>

        <div className="service-clients__slider">
          <div className="service-clients__track">
            {clientsLoop.map((client, index) => (
              <div
                className="service-clients__item"
                key={`${client.id}-${index}`}
                role="img"
                aria-label={client.name}
                style={{
                  backgroundColor: client.bg,
                  backgroundImage: `url("${client.logo}")`,
                  backgroundSize: client.size,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ServiceClients;
