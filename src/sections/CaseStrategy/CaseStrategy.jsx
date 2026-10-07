import { useState } from "react";

import CaseInfoCard from "../../components/CaseInfoCard/CaseInfoCard";

import { useLanguage } from "../../i18n";

import "./CaseStrategy.sass";

function StrategyGallery({
  screenshots = [],
  onImageClick,
  galleryOffset = 0,
}) {
  const { t } = useLanguage();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isChanging, setIsChanging] = useState(false);

  // Скидаємо слайдер лише при зміні набору скріншотів (не при зміні мови)
  const screenshotsKey = screenshots.map(({ image }) => image).join();

  const [prevScreenshotsKey, setPrevScreenshotsKey] = useState(screenshotsKey);

  if (prevScreenshotsKey !== screenshotsKey) {
    setPrevScreenshotsKey(screenshotsKey);
    setActiveIndex(0);
    setIsChanging(false);
  }

  if (!screenshots.length) return null;

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

  const handleImageClick = () => {
    if (!onImageClick) return;

    onImageClick(galleryOffset + activeIndex);
  };

  return (
    <div className="case-strategy__gallery">
      <figure className="case-strategy__screenshot">
        <div className="case-strategy__image-wrapper">
          <button
            className="case-strategy__image-button"
            type="button"
            onClick={handleImageClick}
            aria-label={t("common.openScreenshot", { n: activeIndex + 1 })}
          >
            <img
              className={`case-strategy__image ${
                isChanging ? "case-strategy__image--changing" : ""
              }`}
              src={activeScreenshot.image}
              alt={activeScreenshot.alt || ""}
            />

            {hasSlider && (
              <span className="case-strategy__counter" aria-hidden="true">
                {activeIndex + 1} / {screenshots.length}
              </span>
            )}

            <span className="case-strategy__zoom" aria-hidden="true">
              ⌕
            </span>
          </button>

          {hasSlider && (
            <>
              <button
                className="case-strategy__arrow case-strategy__arrow--prev"
                type="button"
                onClick={handlePrev}
                disabled={isChanging}
                aria-label={t("common.prevScreenshot")}
              >
                ‹
              </button>

              <button
                className="case-strategy__arrow case-strategy__arrow--next"
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
            className={`case-strategy__caption ${
              isChanging ? "case-strategy__caption--changing" : ""
            }`}
          >
            {activeScreenshot.caption}
          </figcaption>
        )}

        {hasSlider && (
          <div className="case-strategy__thumbnails">
            {screenshots.map((screenshot, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  className={`case-strategy__thumbnail ${
                    isActive ? "case-strategy__thumbnail--active" : ""
                  }`}
                  type="button"
                  key={`${screenshot.image}-${index}`}
                  onClick={() => changeSlide(index)}
                  disabled={isChanging}
                  aria-label={t("common.showScreenshot", { n: index + 1 })}
                  aria-current={isActive ? "true" : undefined}
                >
                  <img src={screenshot.image} alt="" loading="lazy" />
                </button>
              );
            })}
          </div>
        )}
      </figure>
    </div>
  );
}

function CaseStrategy({ strategy, onImageClick, galleryOffset = 0 }) {
  const { t } = useLanguage();

  const {
    architecture = [],
    architectureScreenshots = [],
    creative,
    creativeScreenshots = [],
    optimization,
    optimizationScreenshots = [],
    mediaPlan,
    summary,
  } = strategy || {};

  if (!strategy) return null;

  // 05–06
  const architectureOffset = galleryOffset;

  // 07–08
  const creativeOffset = architectureOffset + architectureScreenshots.length;

  // 09+
  const optimizationOffset = creativeOffset + creativeScreenshots.length;

  return (
    <section className="case-strategy">
      <div className="case-strategy__container">
        {/* ARCHITECTURE */}
        {architecture.length > 0 && (
          <div className="case-strategy__block">
            <h3 className="case-strategy__subtitle">
              {strategy.architectureTitle || t("casePage.architecture")}
            </h3>

            <ul className="case-strategy__list">
              {architecture.map((item, index) => (
                <li
                  className="case-strategy__list-item"
                  key={`${item}-${index}`}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {architectureScreenshots.length > 0 && (
          <StrategyGallery
            screenshots={architectureScreenshots}
            onImageClick={onImageClick}
            galleryOffset={architectureOffset}
          />
        )}

        {/* CREATIVE */}
        {creative && (
          <div className="case-strategy__block">
            <h3 className="case-strategy__subtitle">{creative.title}</h3>

            <p className="case-strategy__text">{creative.description}</p>
          </div>
        )}

        {creativeScreenshots.length > 0 && (
          <StrategyGallery
            screenshots={creativeScreenshots}
            onImageClick={onImageClick}
            galleryOffset={creativeOffset}
          />
        )}

        {/* OPTIMIZATION */}
        {optimization && (
          <div className="case-strategy__block">
            <h3 className="case-strategy__subtitle">{optimization.title}</h3>

            <p className="case-strategy__text">{optimization.description}</p>
          </div>
        )}

        {optimizationScreenshots.length > 0 && (
          <StrategyGallery
            screenshots={optimizationScreenshots}
            onImageClick={onImageClick}
            galleryOffset={optimizationOffset}
          />
        )}

        {/* MEDIA PLAN + SUMMARY */}
        {(mediaPlan || summary) && (
          <div className="case-strategy__cards">
            {mediaPlan && (
              <CaseInfoCard
                title={mediaPlan.title}
                items={mediaPlan.items}
                note={mediaPlan.note}
                variant="yellow"
              />
            )}

            {summary && (
              <CaseInfoCard
                title={summary.title}
                description={summary.description}
                variant="green"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default CaseStrategy;
