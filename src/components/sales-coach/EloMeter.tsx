"use client";

import { useId } from "react";

/**
 * EloMeter — the functional gauge for the Sales Effectivity Rating (founder
 * 2026-07-07: "an actual functional meter system that reflects scoring rating";
 * 2026-07-10: "larger, more sporty, eye-catching").
 *
 * A semicircular dial (the gauge metaphor) whose fill reflects the rating's true
 * position on the chess-scale [100, 3000], with a tick at the 1500 measurement
 * standard so "above / below the standard" reads at a glance (§3.6 make-visible;
 * §A11 — position, not a verdict). Sporty treatment: a warm ember→gold gradient
 * (emerald→mint above the standard), an outer glow, and a bright needle-tip marker
 * at the current rating. Theme-agnostic explicit stops (gradients can't use the
 * token currentColor); no red. Pure + presentational. Unique <defs> ids per
 * instance (the team view renders many meters at once).
 */

const MIN = 100;
const MAX = 3000;
const STANDARD = 1500;

export function EloMeter({
  rating,
  size = 72,
}: {
  rating: number;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const gradId = `elo-grad-${uid}`;
  const glowId = `elo-glow-${uid}`;

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const frac = clamp01((rating - MIN) / (MAX - MIN));
  const stdFrac = clamp01((STANDARD - MIN) / (MAX - MIN));
  const aboveStandard = rating >= STANDARD;

  // Sporty = thicker arc. Pad the box so the glow + tip marker don't clip.
  const sw = Math.max(4, Math.round(size * 0.13));
  const pad = Math.round(sw * 0.9);
  const w = size;
  const r = (w - sw) / 2;
  const cx = w / 2;
  const cy = r + sw / 2;
  const h = cy + sw / 2;

  const pointAt = (f: number) => {
    const a = Math.PI * (1 - f); // 180°→0°
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };

  const start = pointAt(0);
  const end = pointAt(1);
  const arcLen = Math.PI * r;
  const tip = pointAt(frac); // current-rating position → needle-tip marker
  const std = pointAt(stdFrac);
  const tickInner = {
    x: cx + (r - sw * 0.9) * Math.cos(Math.PI * (1 - stdFrac)),
    y: cy - (r - sw * 0.9) * Math.sin(Math.PI * (1 - stdFrac)),
  };

  const arcPath = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;

  // Warm, sporty gradient. Below-standard: ember → gold. Above: emerald → mint.
  const stops = aboveStandard
    ? ["#059669", "#34d399", "#a7f3d0"]
    : ["#d97706", "#f59e0b", "#fcd34d"];
  const glowColor = aboveStandard ? "#34d399" : "#f59e0b";

  return (
    <svg
      width={w + pad * 2}
      height={h + pad}
      viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad}`}
      className="shrink-0"
      role="img"
      aria-label={`Rating ${rating} on a ${MIN}-${MAX} scale`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="55%" stopColor={stops[1]} />
          <stop offset="100%" stopColor={stops[2]} />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation={sw * 0.5}
            floodColor={glowColor}
            floodOpacity="0.9"
          />
        </filter>
      </defs>

      {/* Track */}
      <path
        d={arcPath}
        fill="none"
        strokeLinecap="round"
        stroke="currentColor"
        className="text-white/10"
        strokeWidth={sw}
      />

      {/* Gradient fill — proportional to the rating, with an outer glow */}
      <path
        d={arcPath}
        fill="none"
        strokeLinecap="round"
        stroke={`url(#${gradId})`}
        strokeWidth={sw}
        strokeDasharray={`${(frac * arcLen).toFixed(2)} ${arcLen.toFixed(2)}`}
        filter={`url(#${glowId})`}
      />

      {/* Standard tick (1500) */}
      <line
        x1={tickInner.x.toFixed(2)}
        y1={tickInner.y.toFixed(2)}
        x2={std.x.toFixed(2)}
        y2={std.y.toFixed(2)}
        stroke="currentColor"
        className="text-white/50"
        strokeWidth={Math.max(1, sw * 0.32)}
        strokeLinecap="round"
      />

      {/* Bright needle-tip marker at the current rating — the sporty pop */}
      <circle
        cx={tip.x.toFixed(2)}
        cy={tip.y.toFixed(2)}
        r={sw * 0.62}
        fill={stops[2]}
        filter={`url(#${glowId})`}
      />
      <circle
        cx={tip.x.toFixed(2)}
        cy={tip.y.toFixed(2)}
        r={sw * 0.26}
        fill="#ffffff"
      />
    </svg>
  );
}
