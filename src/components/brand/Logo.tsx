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
export function LightbulbMark({
  className,
  filled = false,
}: {
  className?: string;
  /** Render with a matte-black rounded-square background. Use for
   *  contexts where the surface is unknown (login dark / light mode
   *  switching) so the bulb always reads correctly. Default false
   *  (transparent), which is right for sidebar/landing where the
   *  surrounding chrome is consistent. */
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {filled && <rect width="512" height="512" rx="80" fill="#09090B" />}
      <g
        fill="none"
        stroke="#FACC15"
        strokeWidth={32}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 200 340 Q 145 295 145 215 Q 145 110 256 110 Q 367 110 367 215 Q 367 295 312 340 L 312 358 L 200 358 Z" />
        <line x1="210" y1="380" x2="302" y2="380" />
        <line x1="215" y1="402" x2="297" y2="402" />
        <path d="M 232 420 Q 256 442 280 420" />
        <circle cx="250" cy="220" r="42" />
        <path d="M 208 222 L 290 222 Q 302 222 302 236 Q 302 252 284 250" />
      </g>
    </svg>
  );
}
