import { useEffect, useState } from "react";

const pad = (value) => String(value).padStart(2, "0");

/**
 * Зворотний відлік, що перезапускається після завершення.
 * Повертає відформатовані хвилини / секунди / сотих секунди.
 */
export function useCountdown(duration) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    let endTime = Date.now() + duration;

    const timer = setInterval(() => {
      let remaining = endTime - Date.now();

      if (remaining <= 0) {
        endTime = Date.now() + duration;
        remaining = duration;
      }

      setTimeLeft(remaining);
    }, 10);

    return () => clearInterval(timer);
  }, [duration]);

  return {
    minutes: pad(Math.floor(timeLeft / 60000)),
    seconds: pad(Math.floor((timeLeft % 60000) / 1000)),
    centiseconds: pad(Math.floor((timeLeft % 1000) / 10)),
  };
}
