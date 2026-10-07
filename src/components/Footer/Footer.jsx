import Icon from "../../components/Icon/Icon";
import logoMark from "../../assets/images/brand/logo-mark.svg";

import { LocalizedLink, useLanguage, useData } from "../../i18n";

import "./Footer.sass";

function Footer() {
  const currentYear = new Date().getFullYear();

  const { t } = useLanguage();
  const { footerSections, socialLinks } = useData("footerData");
  const { contacts } = useData("headerData");

  return (
    <footer className="footer" id="contacts">
      <div className="footer__container">
        <div className="footer__top">
          <div className="footer__brand">
            <LocalizedLink className="footer__logo" to="/">
              <img
                className="footer__logo-icon"
                src={logoMark}
                alt=""
                width="32"
                height="32"
              />
              <span className="footer__logo-text">
                PIKA<span>LEADS</span>
              </span>
            </LocalizedLink>

            <p className="footer__description">{t("footer.description")}</p>

            <div className="footer__contacts">
              <a className="footer__contact" href={`tel:${contacts.phone}`}>
                <span className="footer__contact-icon">
                  <Icon name="phone" />
                </span>

                <span className="footer__contact-content">
                  <small>{t("footer.phone")}</small>
                  <strong>{contacts.phoneLabel}</strong>
                </span>
              </a>

              <a className="footer__contact" href={`mailto:${contacts.email}`}>
                <span className="footer__contact-icon">
                  <Icon name="mail" />
                </span>

                <span className="footer__contact-content">
                  <small>{t("footer.email")}</small>
                  <strong>{contacts.email}</strong>
                </span>
              </a>

              <div className="footer__contact">
                <span className="footer__contact-icon">
                  <Icon name="location" />
                </span>

                <span className="footer__contact-content">
                  <small>{t("footer.address")}</small>
                  <strong>{contacts.address}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="footer__navigation">
            {footerSections.map((section) => (
              <div className="footer__column" key={section.id}>
                <h3>{section.title}</h3>

                <ul>
                  {section.links.map((link) => (
                    <li key={link.id}>
                      <LocalizedLink to={link.href}>{link.label}</LocalizedLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="footer__column footer__column--socials">
              <h3>{t("footer.socials")}</h3>

              <div className="footer__socials">
                {socialLinks.map((social) => (
                  <a
                    className="footer__social"
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    key={social.id}
                  >
                    <Icon name={social.icon} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="footer__word">PIKALEADS</div>

        <div className="footer__bottom">
          <p>
            {t("footer.legalEntity")} · {contacts.address} ·{" "}
            {t("footer.phoneShort")} {contacts.phoneLabel} · {contacts.email}
          </p>

          <p>
            © {currentYear} Pikaleads. {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
