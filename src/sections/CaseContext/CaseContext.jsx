import { useState } from "react";

import { useLanguage } from "../../i18n";

import "./CaseContext.sass";

function CaseContext({ context, onImageClick, galleryOffset = 0 }) {
  const { t } = useLanguage();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isChanging, setIsChanging] = useState(false);

  // Скидаємо слайдер лише при зміні набору скріншотів (не при зміні мови)
  const screenshotsKey = context?.screenshots?.map(({ image }) => image).join();

  const [prevScreenshotsKey, setPrevScreenshotsKey] = useState(screenshotsKey);

  if (prevScreenshotsKey !== screenshotsKey) {
    setPrevScreenshotsKey(screenshotsKey);
    setActiveIndex(0);
    setIsChanging(false);
  }

  if (!context) return null;

  const { title, description, screenshots = [] } = context;

  if (!screenshots.length) {
    return (
      <section className="case-context">
        <div className="case-context__container">
          <div className="case-context__header">
            {title && <h2 className="case-context__title">{title}</h2>}

            {description && (
              <p className="case-context__description">{description}</p>
            )}
          </div>
        </div>
      </section>
    );
  }

  const activeScreenshot = screenshots[activeIndex];
  const hasSlider = screenshots.length > 1;

  const changeSlide = (newIndex) => {
    if (newIndex === activeIndex || isChanging) return;

    setIsChanging(true);

    window.setTimeout(() => {
      setActiveIndex(newIndex);

      requestAnimationFrame(() => {
        setIsChanging(false);
      });
    }, 180);
  };

  const handlePrev = () => {
    const newIndex =
      activeIndex === 0 ? screenshots.length - 1 : activeIndex - 1;

    changeSlide(newIndex);
  };

  const handleNext = () => {
    const newIndex =
      activeIndex === screenshots.length - 1 ? 0 : activeIndex + 1;

    changeSlide(newIndex);
  };

  return (
    <section className="case-context">
      <div className="case-context__container">
        <div className="case-context__header">
          {title && <h2 className="case-context__title">{title}</h2>}

          {description && (
            <p className="case-context__description">{description}</p>
          )}
        </div>

        <div className="case-context__gallery">
          <figure className="case-context__screenshot">
            <div className="case-context__image-wrapper">
              <button
                className="case-context__image-button"
                type="button"
                onClick={() => onImageClick?.(galleryOffset + activeIndex)}
                aria-label={t("common.openScreenshot", { n: activeIndex + 1 })}
              >
                <img
                  className={`case-context__image ${
                    isChanging ? "case-context__image--changing" : ""
                  }`}
                  src={activeScreenshot.image}
                  alt={activeScreenshot.alt || ""}
                  loading="lazy"
                  decoding="async"
                />

                <span className="case-context__counter" aria-hidden="true">
                  {activeIndex + 1} / {screenshots.length}
                </span>

                <span className="case-context__zoom" aria-hidden="true">
                  ⌕
                </span>
              </button>

              {hasSlider && (
                <>
                  <button
                    className="case-context__arrow case-context__arrow--prev"
                    type="button"
                    onClick={handlePrev}
                    disabled={isChanging}
                    aria-label={t("common.prevScreenshot")}
                  >
                    ‹
                  </button>

                  <button
                    className="case-context__arrow case-context__arrow--next"
                    type="button"
                    onClick={handleNext}
                    disabled={isChanging}
                    aria-label={t("common.nextScreenshot")}
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {activeScreenshot.caption && (
              <figcaption
                className={`case-context__caption ${
                  isChanging ? "case-context__caption--changing" : ""
                }`}
              >
                {activeScreenshot.caption}
              </figcaption>
            )}

            {hasSlider && (
              <div className="case-context__thumbnails">
                {screenshots.map((screenshot, index) => (
                  <button
                    className={`case-context__thumbnail ${
                      index === activeIndex
                        ? "case-context__thumbnail--active"
                        : ""
                    }`}
                    type="button"
                    key={`${screenshot.image}-${index}`}
                    onClick={() => changeSlide(index)}
                    disabled={isChanging}
                    aria-label={t("common.showScreenshot", { n: index + 1 })}
                    aria-current={index === activeIndex ? "true" : undefined}
                  >
                    <img src={screenshot.image} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </figure>
        </div>
      </div>
    </section>
  );
}

export default CaseContext;
