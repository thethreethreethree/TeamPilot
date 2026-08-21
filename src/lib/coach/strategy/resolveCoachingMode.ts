import type { CoachingMode } from "./selectStrategy";

/**
 * Resolve a `coaching_sessions.session_kind` value (migration 0237) to a `CoachingMode` for `selectStrategy`.
 * Single-source for the DB-value → mode mapping. Total + safe-defaulting: any unknown/null/legacy value
 * (including a pre-0237 row that never had the column, or a future kind not yet handled) resolves to `sales`
 * — the pre-Meeting-Coach default — so a mis-set row is coached as sales (wrong, but never a crash, and never a
 * meeting brain fired on an unclassified session).
 */
export function resolveCoachingMode(sessionKind: string | null | undefined): CoachingMode {
  switch (sessionKind) {
    case "meeting":
      return "meeting";
    case "huddle":
      return "huddle";
    case "sales":
      return "sales";
    default:
      return "sales";
  }
}
