import { useLanguage } from "../../i18n";

import "./SliderControls.sass";

/** Пара кнопок «‹ ›» для слайдерів */
function SliderControls({ onPrev, onNext, className = "" }) {
  const { t } = useLanguage();

  return (
    <div className={`slider-controls ${className}`}>
      <button
        className="slider-controls__arrow"
        type="button"
        onClick={onPrev}
        aria-label={t("testimonials.prev")}
      >
        ‹
      </button>

      <button
        className="slider-controls__arrow"
        type="button"
        onClick={onNext}
        aria-label={t("testimonials.next")}
      >
        ›
      </button>
    </div>
  );
}

export default SliderControls;
