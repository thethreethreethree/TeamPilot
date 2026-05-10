"use client";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
}

export default function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  label,
  color,
}: ScoreRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (color) return color;
    if (score >= 80) return "#34d399";
    if (score >= 60) return "#fbbf24";
    return "#f87171";
  };

  const ringColor = getColor();

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#252840"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-lg font-bold"
          style={{ color: ringColor }}
        >
          {score}
        </span>
      </div>
      {label && (
        <span className="text-xs text-[#8895c4] text-center">{label}</span>
      )}
    </div>
  );
}
