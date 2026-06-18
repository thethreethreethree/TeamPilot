"use client";

import { LightbulbMark } from "@/components/brand/Logo";
import { useLearningMode } from "./LearningModeProvider";

/**
 * Floating brand-mark FAB. Visible bottom-right only when:
 *   - Learning Mode preference is enabled, AND
 *   - the resolved theme is dark.
 *
 * Click toggles the `active` state. When active, the bulb glows (a
 * pulsing ember halo) and every <LearningHint>-wrapped element on
 * the page lights up with a popover affordance. Click again to
 * dim — same as flipping a real light switch.
 *
 * The lightbulb IS the ELOSTATE brand mark. The metaphor is literal:
 * a bulb on a dark surface is illumination + guidance + the idea
 * lighting up. That's the brand and the feature in the same object.
 */
export function LearningModeFab() {
  const { enabled, active, isDark, setActive } = useLearningMode();

  if (!enabled || !isDark) return null;

  return (
    <button
      type="button"
      onClick={() => setActive(!active)}
      aria-label={
        active ? "Turn off learning hints" : "Turn on learning hints"
      }
      aria-pressed={active}
      title={
        active
          ? "Learning Mode is ON — hover any element to learn what it does. Click to turn off."
          : "Learning Mode is dim — click to illuminate the interface."
      }
      className={`fixed bottom-5 right-5 z-40 group flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
        active
          ? "bg-ember-400/15 border-2 border-ember-400 shadow-glow-ember-strong"
          : "bg-base/80 border border-default hover:border-ember-400/60 hover:shadow-glow-ember-soft"
      }`}
    >
      <span
        className={`block transition-all duration-300 ${
          active ? "scale-110" : "opacity-50 group-hover:opacity-100"
        }`}
      >
        <LightbulbMark width={28} height={38} />
      </span>
      {active && (
        <span
          className="absolute inset-0 rounded-full animate-ping bg-ember-400/20 pointer-events-none"
          aria-hidden
        />
      )}
    </button>
  );
}
