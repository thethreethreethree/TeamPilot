/**
 * ELOSTATE brand mark + wordmark.
 *
 * Single source of truth for the visual identity. Wraps the canonical
 * brand assets the user provided at `IMMAGE ASSETS/`:
 *
 *   public/elostate-logo.svg   — full logo (bulb + ELOSTATE wordmark)
 *   public/elostate-logo.png   — same, as raster fallback
 *
 * Components:
 *
 *   <BrandLogo />        — the FULL provided logo (bulb + wordmark)
 *                          stacked, as supplied. Use this in hero
 *                          contexts where there's vertical room: login
 *                          page, landing hero, install splash.
 *
 *   <LightbulbMark />    — bulb-only crop of the canonical SVG, no
 *                          wordmark, no fill background. Use this where
 *                          a compact mark is needed alongside other
 *                          text (sidebar header next to the ELOSTATE
 *                          text+tagline, landing header).
 *
 *   <Logo />             — legacy variant API. Renders <LightbulbMark />
 *                          + an Inter-Black "ELOSTATE" text + optional
 *                          tagline. Preferred for places that need a
 *                          horizontal-layout mark + text combo.
 *
 * Tagline copy lives below as TAGLINE / TAGLINE_SHORT — exported so
 * other surfaces (manifest, meta tags, hero headers) reference one
 * source. Canonical positioning, taken from the logo:
 *
 *   TAGLINE        = "Problem Solving System for Teams"
 *   TAGLINE_SHORT  = "Problem Solving for Teams"
 *
 * No "AI Executive Operating System" anywhere — that framing was
 * dropped 2026-06-12 when the new logo became design governance.
 */

import Image from "next/image";
import { cn } from "@/lib/utils";

export const TAGLINE = "Problem Solving System for Teams";
export const TAGLINE_SHORT = "Problem Solving for Teams";

// ─── Full logo (bulb + ELOSTATE wordmark, as provided) ───────────

/**
 * Render the canonical brand asset exactly as provided. The asset
 * itself has a matte-black background and the wordmark below the
 * bulb, so this component just needs a sized container. Use Next's
 * Image so the asset is cached + dimensioned by the framework.
 *
 * Default size is `lg` (160px square). Override via className for
 * specific hero treatments.
 */
export function BrandLogo({
  className,
  width = 160,
  height = 160,
  priority = false,
}: {
  className?: string;
  width?: number;
  height?: number;
  /** Pass priority for above-the-fold hero use so Next prefetches it. */
  priority?: boolean;
}) {
  return (
    <Image
      src="/elostate-logo.svg"
      alt="ELOSTATE — Problem Solving System for Teams"
      width={width}
      height={height}
      priority={priority}
      className={cn("rounded-2xl", className)}
    />
  );
}

// ─── Compact mark (bulb only, derived from canonical SVG) ───────

/**
 * Bulb-only mark, viewBox-cropped from the canonical full-logo SVG.
 *
 * Why inline-SVG instead of <Image>: this needs to scale to 16px
 * (favicon-comparable in component contexts) and 80px (landing hero
 * mark) without re-rasterizing or fetching a new asset per size.
 * The geometry below is a faithful approximation of the bulb portion
 * of the canonical logo — the rounded dome, two-layer line work for
 * the e inside, threads, and base contact.
 *
 * The stroke-width is tuned so the bulb reads cleanly from 16px up.
 * `filled` adds the matte-black rounded-square chip — use it where
 * the surrounding surface is unknown (theme-toggling hero, install
 * splash) so the bulb always has contrast.
 */
export function LightbulbMark({
  className,
  filled = false,
}: {
  className?: string;
  /** Render with a matte-black rounded-square background. */
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

// ─── Legacy variant API (mark + wordmark + optional tagline) ────

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
          className={cn("text-muted tracking-wide", TAGLINE_SIZES[size])}
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
