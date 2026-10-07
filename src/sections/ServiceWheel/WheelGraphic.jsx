function WheelGraphic({ prizes }) {
  const segmentAngle = 360 / prizes.length;

  const getPoint = (angle, radius) => {
    const radians = ((angle - 90) * Math.PI) / 180;

    return {
      x: 110 + radius * Math.cos(radians),
      y: 110 + radius * Math.sin(radians),
    };
  };

  return (
    <svg
      className="service-wheel__svg"
      viewBox="0 0 220 220"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <circle cx="110" cy="110" r="106" className="service-wheel__base" />

      {prizes.map((prize, index) => {
        const start = index * segmentAngle;
        const end = (index + 1) * segmentAngle;
        const middle = (index + 0.5) * segmentAngle;

        const startPoint = getPoint(start, 104);
        const endPoint = getPoint(end, 104);
        const textPoint = getPoint(middle, 64);

        const path = `
          M 110 110
          L ${startPoint.x.toFixed(2)} ${startPoint.y.toFixed(2)}
          A 104 104 0 0 1 ${endPoint.x.toFixed(2)} ${endPoint.y.toFixed(2)}
          Z
        `;

        const isGold = index === 3;
        const isAccent = index % 2 === 0;

        const shouldFlip = middle > 180;
        const textRotation = shouldFlip ? middle + 90 : middle - 90;

        const label = prize.short || prize.label;

        const fontSize = 9;
        const maxWidth = 58;
        const naturalWidth = label.length * fontSize * 0.78;

        let segmentColor = "#141A24";

        if (isGold) {
          segmentColor = "#FFC629";
        } else if (isAccent) {
          segmentColor = "var(--service-accent)";
        }

        return (
          <g key={prize.id}>
            <path
              d={path}
              fill={segmentColor}
              stroke="rgba(0, 0, 0, 0.28)"
              strokeWidth="1"
            />

            <text
              x={textPoint.x}
              y={textPoint.y}
              transform={`rotate(
                ${textRotation}
                ${textPoint.x.toFixed(2)}
                ${textPoint.y.toFixed(2)}
              )`}
              textAnchor="middle"
              dominantBaseline="central"
              textLength={naturalWidth > maxWidth ? maxWidth : undefined}
              lengthAdjust="spacingAndGlyphs"
              fontFamily="Unbounded, sans-serif"
              fontWeight="700"
              fontSize={fontSize}
              fill={isGold ? "#121110" : "#FFFFFF"}
              letterSpacing=".2px"
            >
              {label}
            </text>
          </g>
        );
      })}

      <circle
        cx="110"
        cy="110"
        r="104"
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth="1"
      />

      <circle
        cx="110"
        cy="110"
        r="106"
        fill="none"
        stroke="var(--service-accent)"
        strokeOpacity="0.45"
        strokeWidth="3"
      />
    </svg>
  );
}

export default WheelGraphic;
