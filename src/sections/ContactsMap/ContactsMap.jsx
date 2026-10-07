import Icon from "../../components/Icon/Icon";
import { useLanguage } from "../../i18n";

import "./ContactsMap.sass";

function ContactsMap() {
  const { t } = useLanguage();

  return (
    <section className="contacts-map">
      <div className="contacts-map__container">
        <div className="contacts-map__top">
          <div className="contacts-map__address">
            <span className="contacts-map__pin">
              <Icon name="location" />
            </span>

            <span>{t("contactsPage.mapAddress")}</span>
          </div>

          <a
            className="contacts-map__link"
            href="https://www.google.com/maps/search/?api=1&query=вул.+Млинівська+12+Рівне"
            target="_blank"
            rel="noreferrer"
          >
            {t("contactsPage.openMaps")}
            <span>→</span>
          </a>
        </div>

        <div className="contacts-map__map">
          <iframe
            title="PikaLeads office location"
            src="https://www.openstreetmap.org/export/embed.html?bbox=26.1700%2C50.6100%2C26.3500%2C50.6700&layer=mapnik&marker=50.6358%2C26.2505"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

export default ContactsMap;
