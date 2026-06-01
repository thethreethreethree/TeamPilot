"use client";

interface ScoreRingProps {
  /** null = no score derivable yet. Rule §3.2/§3.4: don't fake one. */
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
  /** When true, an inline "demo" tag is shown so the value isn't mistaken for derived. */
  isDemo?: boolean;
}

export default function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  label,
  color,
  isDemo = false,
}: ScoreRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const hasScore = score !== null && !Number.isNaN(score);
  const offset = hasScore
    ? circumference - ((score as number) / 100) * circumference
    : circumference;

  const getColor = () => {
    if (!hasScore) return "#3a3f5c";
    if (color) return color;
    if ((score as number) >= 80) return "#34d399";
    if ((score as number) >= 60) return "#fbbf24";
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
          {hasScore ? score : "—"}
        </span>
        {isDemo && hasScore && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-[8px] font-semibold uppercase tracking-widest text-yellow-300">
            demo
          </span>
        )}
      </div>
      {label && (
        <span className="text-xs text-[#8895c4] text-center">{label}</span>
      )}
    </div>
  );
}
