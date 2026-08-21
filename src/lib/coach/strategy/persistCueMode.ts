import type { CueMode } from "./coachingStrategy";

/**
 * The `coaching_cues.mode` vocabulary the shared table's CHECK allows (migration 0070:85):
 * `check (mode in ('suggestion','guide_response'))`.
 */
export type CoachingCuesMode = "suggestion" | "guide_response";

/**
 * Map a strategy's generalized `CueMode` ('suggestion'|'directive') to the `coaching_cues.mode` CHECK vocabulary.
 * INTEGRATION LANDMINE (wiring-spec Step 5): a meeting cue can be 'directive', but inserting 'directive' into
 * coaching_cues VIOLATES the CHECK and throws at runtime. This is the single chokepoint that keeps a meeting cue
 * insert legal — total over CueMode, so a future CueMode value is a compile error here, not a runtime CHECK
 * violation in production. Kept pure + next to the strategy types so the persist path and its drift-guard test
 * share one source (§2.2).
 */
export function toCoachingCuesMode(mode: CueMode): CoachingCuesMode {
  switch (mode) {
    case "directive":
      return "guide_response";
    case "suggestion":
      return "suggestion";
  }
}
