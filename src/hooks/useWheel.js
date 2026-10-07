import { useEffect, useRef, useState } from "react";

const SPIN_ROUNDS = 5;
const SPIN_DURATION = 3450;
const CONFETTI_DURATION = 3800;

/** Стан колеса фортуни: обертання, виграш, конфеті, підтвердження */
export function useWheel(prizes) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [prizeIndex, setPrizeIndex] = useState(null);
  const [isClaimed, setIsClaimed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const timeouts = useRef([]);

  useEffect(() => {
    const pending = timeouts.current;

    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const spin = () => {
    if (isSpinning || hasSpun) return;

    const segmentAngle = 360 / prizes.length;
    const prizeIndex = Math.floor(Math.random() * prizes.length);

    // Кут, за якого центр виграшного сегмента опиниться під стрілкою
    const targetAngle = (360 - (prizeIndex + 0.5) * segmentAngle) % 360;
    const currentAngle = ((rotation % 360) + 360) % 360;
    const delta =
      ((targetAngle - currentAngle + 360) % 360) + 360 * SPIN_ROUNDS;

    setHasSpun(true);
    setIsSpinning(true);
    setRotation((previous) => previous + delta);

    timeouts.current.push(
      window.setTimeout(() => {
        setPrizeIndex(prizeIndex);
        setIsSpinning(false);
        setShowConfetti(true);

        timeouts.current.push(
          window.setTimeout(() => setShowConfetti(false), CONFETTI_DURATION),
        );
      }, SPIN_DURATION),
    );
  };

  const claim = () => {
    setShowConfetti(false);
    setIsClaimed(true);
  };

  // Приз береться з актуального (перекладеного) списку, тому при зміні мови
  // назва виграшу теж перекладається
  const prize = prizeIndex === null ? null : prizes[prizeIndex];

  return {
    rotation,
    isSpinning,
    hasSpun,
    prize,
    isClaimed,
    showConfetti,
    spin,
    claim,
  };
}
