import { useEffect, useState } from "react";

import { useLanguage } from "../../i18n";

import "./CaseGallery.sass";

function CaseGallery({ images = [], initialIndex = 0, title, onClose }) {
  const { t } = useLanguage();

  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const total = images.length;
  const activeImage = images[activeIndex];

  const showPrevious = () => {
    setActiveIndex((current) => (current === 0 ? total - 1 : current - 1));
  };

  const showNext = () => {
    setActiveIndex((current) => (current === total - 1 ? 0 : current + 1));
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft" && total > 1) {
        showPrevious();
      }

      if (event.key === "ArrowRight" && total > 1) {
        showNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [total, onClose]);

  if (!activeImage) return null;

  return (
    <div
      className="case-gallery"
      role="dialog"
      aria-modal="true"
      aria-label={title || t("gallery.title")}
    >
      <header className="case-gallery__header">
        <div className="case-gallery__heading">
          <h2 className="case-gallery__title">{title || t("gallery.title")}</h2>

          <span className="case-gallery__counter">
            {t("gallery.counter", { current: activeIndex + 1, total })}
          </span>
        </div>

        <button
          className="case-gallery__close"
          type="button"
          onClick={onClose}
          aria-label={t("gallery.close")}
        >
          ×
        </button>
      </header>

      <div className="case-gallery__viewport">
        <img
          className="case-gallery__image"
          src={activeImage.image}
          alt={activeImage.alt || ""}
        />
      </div>

      <footer className="case-gallery__footer">
        <button
          className="case-gallery__button"
          type="button"
          onClick={showPrevious}
        >
          <span aria-hidden="true">‹</span>
          <span>{t("gallery.prev")}</span>
        </button>

        <div className="case-gallery__pagination">
          {images.map((image, index) => (
            <button
              className={`case-gallery__dot ${
                index === activeIndex ? "case-gallery__dot--active" : ""
              }`}
              type="button"
              key={`${image.image}-${index}`}
              onClick={() => setActiveIndex(index)}
              aria-label={t("common.openScreenshot", { n: index + 1 })}
            />
          ))}
        </div>

        <button
          className="case-gallery__button"
          type="button"
          onClick={showNext}
        >
          <span>{t("gallery.next")}</span>
          <span aria-hidden="true">›</span>
        </button>
      </footer>
    </div>
  );
}

export default CaseGallery;
