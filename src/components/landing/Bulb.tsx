import { BRAND } from "./brand";
import styles from "./Bulb.module.css";

// The mark: a lowercase "e" drawn as a glowing filament inside a bulb silhouette (insight = the
// idea lit). Pure SVG + CSS — robust (filament visible even if animation is skipped), no JS.
// `draw` animates the filament in; `pulse` gives the hero bulb a slow breathing glow. The nav
// uses it small + static.
export function Bulb({
  size = 128,
  draw = false,
  pulse = false,
  className,
}: {
  size?: number;
  draw?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const filament = "M64 40 A16 16 0 1 0 56 55 M33 40 H64";
  const drawCls = draw ? styles.draw : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={[pulse ? styles.pulse : "", className].filter(Boolean).join(" ")}
      aria-label="Elostate — the idea, lit"
      role="img"
    >
      <defs>
        <filter id="bulbGlow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <radialGradient id="bulbFill" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="rgba(255,218,3,.18)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* glass */}
      <path
        d="M50 8 C69 8 84 22 84 42 C84 55 76 63 70 71 L30 71 C24 63 16 55 16 42 C16 22 31 8 50 8 Z"
        fill="url(#bulbFill)"
        stroke="rgba(247,247,245,.30)"
        strokeWidth={2.4}
      />
      {/* screw base */}
      <path d="M39 75 H61 M41 81 H59 M44 88 H56" stroke="rgba(247,247,245,.38)" strokeWidth={2.6} strokeLinecap="round" />
      {/* filament "e" — glow layer + crisp layer */}
      <path className={drawCls} d={filament} filter="url(#bulbGlow)" fill="none" stroke={BRAND.signal} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path className={drawCls} d={filament} fill="none" stroke={BRAND.signal} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
