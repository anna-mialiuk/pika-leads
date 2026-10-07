import ContactForm from "../../components/ContactForm/ContactForm";
import Icon from "../../components/Icon/Icon";

import { useLanguage, useData } from "../../i18n";

import "./ContactsSection.sass";

function ContactsSection() {
  const { t } = useLanguage();
  const { contacts } = useData("headerData");
  const { socialLinks } = useData("footerData");

  return (
    <section className="contacts-section">
      <div className="contacts-section__container">
        <div className="contacts-section__info">
          <h1 className="contacts-section__title">{t("contactsPage.title")}</h1>

          <p className="contacts-section__description">
            {t("contactsPage.description")}
          </p>

          <div className="contacts-section__contacts">
            <div className="contacts-section__contact">
              <span>{t("contactsPage.phone")}</span>

              <a href={`tel:${contacts.phone}`}>{contacts.phoneLabel}</a>
            </div>

            <div className="contacts-section__contact">
              <span>{t("contactsPage.email")}</span>

              <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            </div>

            <div className="contacts-section__contact">
              <span>{t("contactsPage.address")}</span>

              <p>{contacts.address}</p>
            </div>

            {contacts.workingHours && (
              <div className="contacts-section__contact">
                <span>{t("contactsPage.workingHours")}</span>

                <p>{contacts.workingHours}</p>
              </div>
            )}
          </div>

          <div className="contacts-section__socials">
            {socialLinks.map((social) => (
              <a
                className="contacts-section__social"
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                key={social.id}
              >
                <Icon
                  name={social.icon}
                  className="contacts-section__social-icon"
                />
              </a>
            ))}
          </div>
        </div>

        <ContactForm />
      </div>
    </section>
  );
}

export default ContactsSection;
