import { useCallback, useEffect, useRef, useState } from "react";

import Badge from "../../components/Badge/Badge";
import SliderControls from "../../components/SliderControls/SliderControls";

import { useVisibleCards } from "../../hooks/useVisibleCards";
import { useAutoplay } from "../../hooks/useAutoplay";

import { useLanguage, useData } from "../../i18n";

import "./ServiceTestimonials.sass";

const AUTOPLAY_DELAY = 5000;
const TRANSITION_DURATION = 650;
const TRACK_GAP_REM = 2.2;

const CARD_BREAKPOINTS = [{ maxWidth: 768, cards: 1 }];

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2);

function ServiceTestimonials() {
  const sliderRef = useRef(null);

  const { t } = useLanguage();
  const { testimonials } = useData("testimonialsData");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideStep, setSlideStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const visibleCards = useVisibleCards(CARD_BREAKPOINTS, 2, () =>
    setCurrentIndex(0),
  );

  const total = testimonials.length;
  const lastIndex = Math.max(total - visibleCards, 0);

  useEffect(() => {
    const calculateStep = () => {
      if (!sliderRef.current) return;

      const sliderWidth = sliderRef.current.getBoundingClientRect().width;
      const rootFontSize = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const gap = TRACK_GAP_REM * rootFontSize;
      const cardWidth = (sliderWidth - gap * (visibleCards - 1)) / visibleCards;

      setSlideStep(cardWidth + gap);
    };

    calculateStep();

    const observer = new ResizeObserver(calculateStep);
    observer.observe(sliderRef.current);

    return () => observer.disconnect();
  }, [visibleCards]);

  const handleNext = useCallback(
    () =>
      setCurrentIndex((previous) => (previous >= lastIndex ? 0 : previous + 1)),
    [lastIndex],
  );

  const handlePrev = () =>
    setCurrentIndex((previous) => (previous <= 0 ? lastIndex : previous - 1));

  useAutoplay(handleNext, AUTOPLAY_DELAY, {
    paused: isPaused,
    enabled: slideStep > 0 && total > visibleCards,
  });

  if (!total) return null;

  return (
    <section className="service-testimonials">
      <div className="service-testimonials__decor service-testimonials__decor--left" />
      <div className="service-testimonials__decor service-testimonials__decor--right" />

      <div className="service-testimonials__container">
        <div className="service-testimonials__heading">
          <div className="service-testimonials__heading-content">
            <Badge className="service-testimonials__badge" variant="service">
              {t("testimonials.badge")}
            </Badge>

            <h2 className="service-testimonials__title">
              {t("testimonials.titleStart")}
              <span>{t("testimonials.titleAccent")}</span>
            </h2>
          </div>

          {total > visibleCards && (
            <SliderControls
              className="service-testimonials__controls"
              onPrev={handlePrev}
              onNext={handleNext}
            />
          )}
        </div>

        <div
          className="service-testimonials__slider"
          ref={sliderRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className="service-testimonials__track"
            style={{
              transform: `translate3d(-${currentIndex * slideStep}px, 0, 0)`,
              transition: `transform ${TRANSITION_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            {testimonials.map((testimonial) => (
              <article
                className="service-testimonials__card"
                key={testimonial.id}
              >
                <span className="service-testimonials__quote">“</span>

                <div className="service-testimonials__top">
                  <div className="service-testimonials__source">
                    {testimonial.source || t("testimonials.defaultSource")}
                  </div>

                  <div className="service-testimonials__stars">★★★★★</div>

                  {testimonial.metric && (
                    <div className="service-testimonials__metric">
                      {testimonial.metric}
                    </div>
                  )}
                </div>

                <p className="service-testimonials__text">{testimonial.text}</p>

                <div className="service-testimonials__author">
                  <div className="service-testimonials__avatar">
                    {testimonial.initials || getInitials(testimonial.name)}
                  </div>

                  <div className="service-testimonials__author-info">
                    <strong>{testimonial.name}</strong>
                    {testimonial.role && <span>{testimonial.role}</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ServiceTestimonials;
