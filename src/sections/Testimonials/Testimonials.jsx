import { useCallback, useEffect, useRef, useState } from "react";

import Badge from "../../components/Badge/Badge";
import SliderControls from "../../components/SliderControls/SliderControls";
import TestimonialCard from "../../components/TestimonialCard/TestimonialCard";

import { useVisibleCards } from "../../hooks/useVisibleCards";
import { useAutoplay } from "../../hooks/useAutoplay";

import { useLanguage, useData } from "../../i18n";

import "./Testimonials.sass";

const AUTOPLAY_DELAY = 5000;
const TRANSITION_DURATION = 650;

const CARD_BREAKPOINTS = [
  { maxWidth: 768, cards: 1 },
  { maxWidth: 1024, cards: 2 },
];

/** Нескінченний слайдер: клони крайніх карток з обох боків треку */
function Testimonials() {
  const sliderRef = useRef(null);

  const { t } = useLanguage();
  const { testimonials } = useData("testimonialsData");

  const [currentIndex, setCurrentIndex] = useState(3);
  const [slideStep, setSlideStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const visibleCards = useVisibleCards(CARD_BREAKPOINTS, 3, (cards) => {
    setIsTransitioning(false);
    setCurrentIndex(cards);
  });

  const total = testimonials.length;

  const slides = [
    ...testimonials.slice(-visibleCards),
    ...testimonials,
    ...testimonials.slice(0, visibleCards),
  ];

  // Крок зсуву = ширина слайда + gap треку
  useEffect(() => {
    const calculateStep = () => {
      const slide = sliderRef.current?.querySelector(".testimonials__slide");
      const track = sliderRef.current?.querySelector(".testimonials__track");

      if (!slide || !track) return;

      const { columnGap, gap } = window.getComputedStyle(track);

      setSlideStep(
        slide.getBoundingClientRect().width +
          (parseFloat(columnGap) || parseFloat(gap) || 0),
      );
    };

    calculateStep();

    const observer = new ResizeObserver(calculateStep);
    observer.observe(sliderRef.current);

    return () => observer.disconnect();
  }, [visibleCards]);

  const goTo = useCallback(
    (index) => {
      if (isTransitioning) return;

      setIsTransitioning(true);
      setCurrentIndex(index);
    },
    [isTransitioning],
  );

  const handleNext = useCallback(() => {
    setIsTransitioning(true);
    setCurrentIndex((previous) => previous + 1);
  }, []);

  useAutoplay(handleNext, AUTOPLAY_DELAY, {
    paused: isPaused,
    enabled: slideStep > 0,
  });

  // Після переходу на клон стрибаємо без анімації на реальний слайд
  const handleTransitionEnd = () => {
    setIsTransitioning(false);

    if (currentIndex >= total + visibleCards) setCurrentIndex(visibleCards);
    else if (currentIndex < visibleCards)
      setCurrentIndex(total + visibleCards - 1);
  };

  const activeIndex = (currentIndex - visibleCards + total) % total;

  return (
    <section className="testimonials">
      <div className="testimonials__container">
        <Badge className="testimonials__label">{t("testimonials.badge")}</Badge>

        <div className="testimonials__heading">
          <div className="testimonials__heading-content">
            <h2 className="testimonials__title">
              {t("testimonials.titleStart")}
              <span>{t("testimonials.titleAccent")}</span>
            </h2>

            <p className="testimonials__description">
              {t("testimonials.description")}
            </p>
          </div>

          <SliderControls
            onPrev={() => goTo(currentIndex - 1)}
            onNext={() => goTo(currentIndex + 1)}
          />
        </div>

        <div
          className="testimonials__slider"
          ref={sliderRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className="testimonials__track"
            style={{
              transform: `translate3d(-${currentIndex * slideStep}px, 0, 0)`,
              transition: isTransitioning
                ? `transform ${TRANSITION_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`
                : "none",
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {slides.map((testimonial, index) => (
              <div
                className="testimonials__slide"
                key={`${testimonial.id}-${index}`}
              >
                <TestimonialCard {...testimonial} />
              </div>
            ))}
          </div>
        </div>

        <div className="testimonials__pagination">
          {testimonials.map((testimonial, index) => (
            <button
              className={`testimonials__dot ${
                index === activeIndex ? "testimonials__dot--active" : ""
              }`}
              type="button"
              key={testimonial.id}
              onClick={() => goTo(index + visibleCards)}
              aria-label={t("testimonials.goTo", { n: index + 1 })}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
