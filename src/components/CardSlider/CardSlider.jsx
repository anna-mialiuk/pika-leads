import { Children, useCallback, useEffect, useRef, useState } from "react";

import SliderControls from "../SliderControls/SliderControls";

import "./CardSlider.sass";

/**
 * Ряд карток: на десктопі — сітка (стилі дає trackClassName секції),
 * на екранах ≤1024px — слайдер зі стрілками «‹ ›», як у відгуках:
 * 2 картки на ноутбуці/планшеті, 1 на телефоні. Працює і свайпом.
 */
function CardSlider({ children, trackClassName = "", className = "" }) {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    setEdges({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    // без прямого виклику тут: ResizeObserver спрацює одразу після розкладки
    // і прочитає розміри без примусового перерахунку (forced reflow)
    track.addEventListener("scroll", updateEdges, { passive: true });

    const observer = new ResizeObserver(updateEdges);
    observer.observe(track);

    return () => {
      track.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, [updateEdges]);

  const scrollBySlide = (direction) => {
    const track = trackRef.current;
    const slide = track?.firstElementChild;
    if (!slide) return;

    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;

    track.scrollBy({
      left: direction * (slide.getBoundingClientRect().width + gap),
      behavior: "smooth",
    });
  };

  return (
    <div className={`card-slider ${className}`}>
      <SliderControls
        className="card-slider__controls"
        onPrev={() => scrollBySlide(-1)}
        onNext={() => scrollBySlide(1)}
        disablePrev={edges.start}
        disableNext={edges.end}
      />

      <div className={`card-slider__track ${trackClassName}`} ref={trackRef}>
        {Children.map(children, (child) =>
          child ? <div className="card-slider__slide">{child}</div> : null,
        )}
      </div>
    </div>
  );
}

export default CardSlider;
