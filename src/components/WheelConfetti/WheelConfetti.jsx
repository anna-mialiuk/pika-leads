import "./WheelConfetti.sass";

const colors = [
  "#FFC629",
  "#0866FF",
  "#4FD88A",
  "#D62976",
  "#ffffff",
  "#6ea8ff",
];

const confettiPieces = Array.from({ length: 64 }).map((_, index) => {
  const width = 6 + Math.round(Math.random() * 7);
  const round = Math.random() > 0.5;

  return {
    id: index,
    left: `${(Math.random() * 100).toFixed(1)}%`,
    width: `${width}px`,
    height: `${round ? width : Math.round(width * 0.5)}px`,
    background: colors[index % colors.length],
    radius: round ? "50%" : "1px",
    duration: `${(2.4 + Math.random() * 1.9).toFixed(2)}s`,
    delay: `${(Math.random() * 0.5).toFixed(2)}s`,
    direction: Math.random() > 0.5 ? "right" : "left",
  };
});

function WheelConfetti({ active }) {
  if (!active) return null;

  return (
    <div className="wheel-confetti" aria-hidden="true">
      {confettiPieces.map((piece) => (
        <span
          key={piece.id}
          className={`wheel-confetti__piece wheel-confetti__piece--${piece.direction}`}
          style={{
            left: piece.left,
            width: piece.width,
            height: piece.height,
            background: piece.background,
            borderRadius: piece.radius,
            animationDuration: piece.duration,
            animationDelay: piece.delay,
          }}
        />
      ))}
    </div>
  );
}

export default WheelConfetti;
