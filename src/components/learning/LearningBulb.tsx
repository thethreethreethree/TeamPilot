"use client";

import Image from "next/image";

/**
 * The Learning Mode lightbulb — Edison-style filament bulb with a
 * warm amber glow when ON. When OFF the filament's built-in glow
 * is dampened via grayscale + brightness reduction so it reads as
 * "the bulb is off" rather than "the bulb is just sitting there
 * glowing." Per founder direction 2026-06-18: a lightbulb only
 * earns its glow when it's actually doing its job.
 *
 * Sourced from /public/learning-bulb.png (614×614 RGBA, served via
 * next/image which resizes + converts to WebP/AVIF at the edge —
 * the full source never reaches the client).
 *
 * Two states:
 *   - glowing=true  → full color, brightness intact; combine with
 *     an ember halo on the parent for the "lightbulb just turned
 *     on" effect.
 *   - glowing=false → desaturated + dimmed; reads as a dormant
 *     bulb. The brand metaphor stays consistent (it's still the
 *     same bulb) but the visual state is honest.
 *
 * Distinct from the LightbulbMark brand-logo component:
 *   - LightbulbMark = the canonical ELOSTATE brand mark, used in
 *     navigation chrome, hero contexts, and the wordmark+logo combo.
 *   - LearningBulb = the Learning Mode mascot. Same metaphor (idea
 *     + guidance + illumination) rendered with more visual warmth.
 *
 * `priority` is opt-in via the prop because the FAB is below the
 * fold initially and shouldn't compete with the page chrome for
 * eager loading. The AskJeffPanel header passes `priority` because
 * the slide-out animates in immediately when invoked.
 */
export function LearningBulb({
  size = 28,
  glowing = true,
  priority = false,
  className,
}: {
  size?: number;
  glowing?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/learning-bulb.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={className}
      aria-hidden
      style={{
        filter: glowing
          ? // Slight saturation bump + a tiny drop-shadow so the bulb
            // looks like it's actually emitting light, not just
            // rendered amber.
            "saturate(1.1) drop-shadow(0 0 6px rgba(250,204,21,0.5))"
          : // Off: most of the saturation gone + dimmed + a subtle
            // blur so the eye reads "dormant" instantly. Not fully
            // grayscale so the bulb is still recognizable as the
            // Edison filament shape.
            "grayscale(0.7) brightness(0.55) opacity(0.85)",
        transition: "filter 300ms ease",
      }}
    />
  );
}
