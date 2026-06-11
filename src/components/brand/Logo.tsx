/**
 * ELOSTATE brand mark + wordmark.
 *
 * Single source of truth for the visual identity. Wraps the canonical
 * brand assets the user provided at `IMMAGE ASSETS/`:
 *
 *   public/elostate-logo.svg     — full logo (bulb + wordmark)
 *   public/elostate-bulb.svg     — bulb only, transparent bg
 *   public/elostate-wordmark.svg — wordmark only, transparent bg
 *
 * Components:
 *
 *   <BrandLogo />     — the full stacked logo. Use in hero contexts
 *                       (login, landing hero, install splash).
 *
 *   <LightbulbMark /> — bulb only. Use in compact mark slots
 *                       (sidebar header, landing top-nav, error pages).
 *
 *   <Wordmark />      — wordmark only. Use where the page chrome
 *                       already has the bulb (footer credit, dark hero
 *                       with separate mark, etc.). White fill — use
 *                       only on dark surfaces, or alongside Inter-Black
 *                       text if theme adaptability is needed.
 *
 *   <Logo />          — legacy mark + Inter-Black "ELOSTATE" text combo
 *                       for theme-adaptive surfaces (light mode needs
 *                       dark text; the canonical wordmark asset is
 *                       pure white).
 *
 * Tagline constants — single source for manifest / meta / heroes:
 *
 *   TAGLINE        = "Problem Solving System for Teams"
 *   TAGLINE_SHORT  = "Problem Solving for Teams"
 */

import Image from "next/image";
import { cn } from "@/lib/utils";

export const TAGLINE = "Problem Solving System for Teams";
export const TAGLINE_SHORT = "Problem Solving for Teams";

// ─── Full logo (bulb + wordmark, as provided) ────────────────────

export function BrandLogo({
  className,
  width = 160,
  height = 160,
  priority = false,
}: {
  className?: string;
  width?: number;
  height?: number;
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

// ─── Bulb only (transparent, amber) ─────────────────────────────

/**
 * Canonical bulb mark — amber, transparent background. Renders
 * cleanly on both dark and light surfaces because amber-yellow holds
 * contrast on both per the brand governance.
 *
 * For favicon use, see src/app/icon.svg which wraps a chip-backed
 * version (transparent amber on light browser-tab chrome is too low
 * contrast).
 *
 * The asset's native aspect is 255×354 (taller than wide). Pass
 * dimensions or a className that controls width — height auto-
 * scales to preserve the aspect ratio.
 */
export function LightbulbMark({
  className,
  width = 36,
  height = 50,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <Image
      src="/elostate-bulb.svg"
      alt=""
      width={width}
      height={height}
      className={className}
      aria-hidden
    />
  );
}

// ─── Wordmark only (transparent, white) ─────────────────────────

/**
 * Canonical ELOSTATE wordmark — white, transparent background. The
 * asset is pure white fill so it only reads on dark surfaces. For
 * theme-adaptive surfaces, use <Logo variant="wordmark-only" /> which
 * renders Inter-Black text that follows text-primary.
 */
export function Wordmark({
  className,
  width = 140,
  height = 31,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <Image
      src="/elostate-wordmark.svg"
      alt="ELOSTATE"
      width={width}
      height={height}
      className={className}
    />
  );
}

// ─── Legacy variant API (mark + Inter-Black text combo) ─────────

type Variant = "mark" | "wordmark" | "wordmark-only";
type Size = "sm" | "md" | "lg" | "xl";

const MARK_DIMS: Record<Size, { w: number; h: number }> = {
  sm: { w: 22, h: 30 },
  md: { w: 28, h: 39 },
  lg: { w: 40, h: 56 },
  xl: { w: 52, h: 72 },
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
  const dims = MARK_DIMS[size];
  const mark = variant !== "wordmark-only" && (
    <LightbulbMark
      width={dims.w}
      height={dims.h}
      className="flex-shrink-0"
    />
  );

  const word = variant !== "mark" && (
    <div className="flex flex-col">
      <span
        className={cn(
          "font-black tracking-tight text-primary leading-none",
          WORDMARK_SIZES[size]
        )}
        style={{ letterSpacing: "-0.01em" }}
      >
        ELOSTATE
      </span>
      {showTagline && (
        <span
          className={cn("text-muted tracking-wide mt-1", TAGLINE_SIZES[size])}
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
