import { useEffect } from "react";

/** Викликає callback кожні delay мс, поки не на паузі та enabled */
export function useAutoplay(
  callback,
  delay,
  { paused = false, enabled = true },
) {
  useEffect(() => {
    if (paused || !enabled) return undefined;

    const interval = setInterval(callback, delay);

    return () => clearInterval(interval);
  }, [callback, delay, paused, enabled]);
}
