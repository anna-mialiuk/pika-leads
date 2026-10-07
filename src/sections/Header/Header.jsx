import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoMark from "../../assets/images/brand/logo-mark.svg";

import { useLanguage, useData } from "../../i18n";

import Button from "../../components/Button/Button";

import Icon from "../../components/Icon/Icon";

import "./Header.sass";

function Header() {
  const location = useLocation();

  const {
    t,
    link,
    language: currentLanguage,
    languages,
    switchPath,
  } = useLanguage();
  const { contacts, navigationItems } = useData("headerData");

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLanguageChange = () => {
    setIsLangOpen(false);
    setIsMenuOpen(false);
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
    setIsLangOpen(false);
  };

  const handleNavClick = (href) => {
    handleMenuClose();

    if (!href.includes("#")) {
      return;
    }

    const hash = href.split("#")[1];

    if (location.pathname === link("/")) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });

      return;
    }

    window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const renderNavLink = (label, href, className) => (
    <Link
      className={className}
      to={link(href)}
      key={href}
      onClick={() => handleNavClick(href)}
    >
      {label}
    </Link>
  );

  return (
    <header className="header">
      <div className="header__container">
        <Link className="header__logo" to={link("/")} onClick={handleMenuClose}>
          <img
            className="header__logo-icon"
            src={logoMark}
            alt=""
            width="36"
            height="36"
          />

          <span className="header__logo-text">
            PIKA<span>LEADS</span>
          </span>
        </Link>

        <nav className="header__nav">
          {navigationItems.map(({ label, href }) =>
            renderNavLink(label, href, "header__nav-link"),
          )}
        </nav>

        <div className="header__actions">
          <div className="header__language">
            <button
              className="header__language-button"
              type="button"
              aria-label={t("header.chooseLanguage")}
              aria-expanded={isLangOpen}
              onClick={() => setIsLangOpen((prev) => !prev)}
            >
              <img
                className="header__language-flag"
                src={currentLanguage.flag}
                alt=""
                width="20"
                height="14"
              />

              <span className="header__language-code">
                {currentLanguage.label}
              </span>

              <Icon
                name="chevron-down"
                className={`header__language-arrow ${
                  isLangOpen ? "header__language-arrow--active" : ""
                }`}
              />
            </button>

            {isLangOpen && (
              <div className="header__language-list">
                {languages.map((language) => (
                  <Link
                    className={`header__language-item ${
                      currentLanguage.code === language.code
                        ? "header__language-item--active"
                        : ""
                    }`}
                    to={switchPath(language.code)}
                    state={{ languageSwitch: true }}
                    hrefLang={language.htmlLang}
                    lang={language.htmlLang}
                    key={language.code}
                    onClick={handleLanguageChange}
                  >
                    <img
                      className="header__language-item-flag"
                      src={language.flag}
                      alt=""
                      width="20"
                      height="14"
                    />

                    <span className="header__language-name">
                      {language.name}
                    </span>

                    <span className="header__language-item-code">
                      {language.label}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <a className="header__phone" href={`tel:${contacts.phone}`}>
            <Icon name="phone" className="header__phone-icon" />

            <span>{t("common.call")}</span>
          </a>

          <Button
            href="#consultation"
            source="header"
            variant="primary"
            size="small"
            arrow
          >
            {t("common.getConsultation")}
          </Button>
        </div>

        <button
          className={`header__burger ${
            isMenuOpen ? "header__burger--active" : ""
          }`}
          type="button"
          aria-label={t("header.openMenu")}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div
        className={`header__mobile-menu ${
          isMenuOpen ? "header__mobile-menu--open" : ""
        }`}
      >
        <nav className="header__mobile-nav">
          {navigationItems.map(({ label, href }) =>
            renderNavLink(label, href, "header__mobile-nav-link"),
          )}
        </nav>

        <div className="header__mobile-language">
          <span className="header__mobile-label">{t("header.language")}</span>

          <div className="header__mobile-language-list">
            {languages.map((language) => (
              <Link
                className={`header__mobile-language-item ${
                  currentLanguage.code === language.code
                    ? "header__mobile-language-item--active"
                    : ""
                }`}
                to={switchPath(language.code)}
                state={{ languageSwitch: true }}
                hrefLang={language.htmlLang}
                lang={language.htmlLang}
                key={language.code}
                onClick={handleLanguageChange}
              >
                <img
                  className="header__mobile-language-flag"
                  src={language.flag}
                  alt=""
                  width="20"
                  height="14"
                />

                <strong>{language.label}</strong>
              </Link>
            ))}
          </div>
        </div>

        <div className="header__mobile-actions">
          <a className="header__mobile-phone" href={`tel:${contacts.phone}`}>
            <Icon name="phone" />

            <span>{t("common.call")}</span>
          </a>

          <Button
            className="header__mobile-cta"
            href="#consultation"
            source="header-mobile"
            variant="primary"
            size="large"
            arrow
            onClick={handleMenuClose}
          >
            {t("common.getConsultation")}
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Header;
