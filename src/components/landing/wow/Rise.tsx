"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * The ONLY entrance primitive for the landing rebuild — and the chokepoint that makes the
 * fail-closed reveal class unexpressible rather than merely discouraged.
 *
 * The class, from three separate instances in the hero build plus one variant in the sections
 * build: an entrance whose resting state is invisible (or, worse, whose resting VALUE is wrong)
 * leaves real content missing whenever the animation has not run — pre-hydration paint, JS
 * disabled or errored, a slow client, a headless capture. `Reveal.tsx` had documented the correct
 * rule for months ("the content ships visible; JS only arms the hidden-then-reveal behavior when
 * it's actually running") and it was broken anyway, four times, one directory away.
 *
 * A grep-based gate was declined under A33: `opacity: 0` has legitimate uses on this page (the
 * transparent range input, deliberate overlays) so a detector would fire on correct code and be
 * learned-around. This component is the chokepoint answer instead — the API accepts only a
 * TRANSLATION DISTANCE. There is no opacity prop, so an author using it cannot express a
 * fade-from-nothing, and the worst available failure is "present but not slid".
 *
 * If a future entrance genuinely needs opacity, that is a deliberate decision to make HERE, once,
 * with this comment in front of the author — not silently in a section file.
 */
export function Rise({
  children,
  delay = 0,
  y = 26,
  x = 0,
  className,
}: {
  children: ReactNode;
  /** seconds before the entrance starts */
  delay?: number;
  /** px to travel vertically; 0 disables */
  y?: number;
  /** px to travel horizontally; 0 disables */
  x?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { y: 0, x: 0 } : { y, x }}
      whileInView={{ y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.85, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
