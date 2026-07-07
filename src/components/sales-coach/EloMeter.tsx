/**
 * EloMeter — the functional gauge for the Sales Effectivity Rating (founder
 * 2026-07-07: "an actual functional meter system that reflects scoring rating").
 *
 * A semicircular dial (matching the gauge metaphor) whose ember fill reflects the
 * rating's true position on the chess-scale [100, 3000], with a tick at the 1500
 * measurement standard so "above / below the standard" reads at a glance (§3.6
 * make-visible; §A11 — position, not a verdict). Brand identity: ember fill on a
 * faint track, theme-aware via `currentColor` + the brand/muted tokens; no red.
 * Pure + presentational.
 */

const MIN = 100;
const MAX = 3000;
const STANDARD = 1500;

export function EloMeter({
  rating,
  size = 46,
}: {
  rating: number;
  size?: number;
}) {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const frac = clamp01((rating - MIN) / (MAX - MIN));
  const stdFrac = clamp01((STANDARD - MIN) / (MAX - MIN));

  // Geometry: a top semicircle. Stroke width leaves room inside the box.
  const sw = Math.max(3, Math.round(size * 0.11));
  const w = size;
  const r = (w - sw) / 2;
  const cx = w / 2;
  const cy = r + sw / 2; // baseline sits at the arc's flat edge
  const h = cy + sw / 2;

  // Point on the top semicircle at fraction f (0 = left/180°, 1 = right/0°).
  const pointAt = (f: number) => {
    const a = Math.PI * (1 - f); // 180°→0°
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };

  const start = pointAt(0);
  const end = pointAt(1);
  const arcLen = Math.PI * r; // semicircle length

  // Above the standard reads as gained ground → emerald tip; below → ember.
  const aboveStandard = rating >= STANDARD;

  const std = pointAt(stdFrac);
  // A short radial tick at the standard.
  const tickOuter = std;
  const tickInner = {
    x: cx + (r - sw * 0.9) * Math.cos(Math.PI * (1 - stdFrac)),
    y: cy - (r - sw * 0.9) * Math.sin(Math.PI * (1 - stdFrac)),
  };

  const arcPath = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      role="img"
      aria-label={`Rating ${rating} on a ${MIN}-${MAX} scale`}
    >
      {/* Track */}
      <path
        d={arcPath}
        fill="none"
        strokeLinecap="round"
        className="text-white/10"
        stroke="currentColor"
        strokeWidth={sw}
      />
      {/* Fill — proportional to the rating */}
      <path
        d={arcPath}
        fill="none"
        strokeLinecap="round"
        className={aboveStandard ? "text-emerald-400" : "text-brand"}
        stroke="currentColor"
        strokeWidth={sw}
        strokeDasharray={`${(frac * arcLen).toFixed(2)} ${arcLen.toFixed(2)}`}
      />
      {/* Standard tick (1500) */}
      <line
        x1={tickInner.x.toFixed(2)}
        y1={tickInner.y.toFixed(2)}
        x2={tickOuter.x.toFixed(2)}
        y2={tickOuter.y.toFixed(2)}
        className="text-white/40"
        stroke="currentColor"
        strokeWidth={Math.max(1, sw * 0.35)}
        strokeLinecap="round"
      />
    </svg>
  );
}
