import { useEffect, useState } from "react";

/**
 * Скільки карток слайдера показувати залежно від ширини вікна.
 * breakpoints — масив [{ maxWidth, cards }], відсортований за зростанням maxWidth.
 */
export function useVisibleCards(breakpoints, fallback, onChange) {
  const getVisibleCards = () => {
    const match = breakpoints.find(
      ({ maxWidth }) => window.innerWidth <= maxWidth,
    );

    return match ? match.cards : fallback;
  };

  // перший рендер — як на сервері (пререндер), реальна ширина — одразу після гідратації
  const [visibleCards, setVisibleCards] = useState(fallback);

  useEffect(() => {
    const handleResize = () => {
      const cards = getVisibleCards();

      setVisibleCards((previous) => {
        if (previous !== cards) onChange?.(cards);

        return cards;
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return visibleCards;
}
