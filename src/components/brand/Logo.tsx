/**
 * ELOSTATE brand mark + wordmark.
 *
 * Single source of truth for the visual identity. Drop this component
 * wherever the logo belongs — sidebar, landing, login, pitch, error
 * pages, install prompts. Use the `variant` prop to choose:
 *
 *   - "mark"       → just the lightbulb (square aspect, scales with size)
 *   - "wordmark"   → mark + ELOSTATE text + optional tagline (default)
 *   - "wordmark-only" → text only, no mark (rare — footer-style use)
 *
 * The mark itself is the canonical lightbulb-with-stylized-e on amber
 * (#FACC15). Background is always transparent here; if you need a
 * filled chip wrap this in a div with bg-base / bg-ink-950 / etc.
 *
 * The wordmark uses Inter Black (weight 900) to match the logo's bold
 * sans-serif. Tracking is tight (-0.02em) to read as a solid block.
 *
 * The tagline copy lives below as TAGLINE constant — exported so other
 * surfaces (manifest, meta tags, hero headers) can reference one
 * source. The current canonical tagline, taken directly from the
 * design-governance logo, is:
 *
 *   "Problem Solving System for Teams"
 *
 * No "AI Executive Operating System" anywhere — that framing was
 * dropped 2026-06-12 when the new logo became design governance.
 */

import { cn } from "@/lib/utils";

export const TAGLINE = "Problem Solving System for Teams";
export const TAGLINE_SHORT = "Problem Solving for Teams";

type Variant = "mark" | "wordmark" | "wordmark-only";
type Size = "sm" | "md" | "lg" | "xl";

const MARK_SIZES: Record<Size, string> = {
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

const WORDMARK_SIZES: Record<Size, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-4xl",
};

const TAGLINE_SIZES: Record<Size, string> = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-base",
};

export function Logo({
  variant = "wordmark",
  size = "md",
  showTagline = false,
  className,
}: {
  variant?: Variant;
  size?: Size;
  /** Show "Problem Solving System for Teams" under the wordmark. */
  showTagline?: boolean;
  className?: string;
}) {
  const mark = variant !== "wordmark-only" && (
    <LightbulbMark className={cn(MARK_SIZES[size], "flex-shrink-0")} />
  );

  const word = variant !== "mark" && (
    <div className="flex flex-col">
      <span
        className={cn(
          "font-black tracking-tight text-primary",
          WORDMARK_SIZES[size]
        )}
        style={{ letterSpacing: "-0.01em" }}
      >
        ELOSTATE
      </span>
      {showTagline && (
        <span
          className={cn(
            "text-muted tracking-wide",
            TAGLINE_SIZES[size]
          )}
        >
          {TAGLINE}
        </span>
      )}
    </div>
  );

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {mark}
      {word}
    </div>
  );
}

/**
 * Just the lightbulb SVG — inline so it can be styled with CSS
 * (stroke="currentColor"-style overrides if needed via a className
 * wrapper that sets color, though by default the stroke is hard-amber
 * to keep brand consistency).
 *
 * Geometry mirrors public/icon.svg exactly so the favicon, PWA icon,
 * and inline component all render the same shape at any size.
 */
export function LightbulbMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g
        fill="none"
        stroke="#FACC15"
        strokeWidth={18}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 205 340 Q 158 300 158 218 Q 158 122 256 122 Q 354 122 354 218 Q 354 300 307 340 L 307 360 L 205 360 Z" />
        <line x1="212" y1="380" x2="300" y2="380" />
        <line x1="218" y1="402" x2="294" y2="402" />
        <path d="M 238 422 Q 256 440 274 422" />
        <circle cx="248" cy="220" r="38" />
        <path d="M 213 222 L 286 222 Q 296 222 296 234 Q 296 247 280 245" />
      </g>
    </svg>
  );
}
