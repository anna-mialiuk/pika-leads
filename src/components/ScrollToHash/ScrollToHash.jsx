import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Прокрутка при переході між сторінками:
 *  - є #hash → плавно до секції з урахуванням висоти хедера;
 *  - немає hash → на початок сторінки;
 *  - перемикання мови → лишаємося там, де були.
 */
function ScrollToHash() {
  const { pathname, hash, state } = useLocation();
  const isLanguageSwitch = Boolean(state?.languageSwitch);

  useEffect(() => {
    if (isLanguageSwitch) return undefined;

    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return undefined;
    }

    const id = decodeURIComponent(hash.slice(1));

    const frameId = window.requestAnimationFrame(() => {
      const element = document.getElementById(id);

      if (!element) return;

      const header = document.querySelector(".header");
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const top =
        element.getBoundingClientRect().top + window.scrollY - headerHeight;

      window.scrollTo({ top, behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname, hash, isLanguageSwitch]);

  return null;
}

export default ScrollToHash;
