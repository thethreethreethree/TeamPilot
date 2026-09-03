/**
 * Gamification band constants — the CLIENT-SAFE single source of truth (no `server-only` import) so both server code
 * (rubric.ts, points.ts, bankPoints.ts) and client UI (the rep Arena) share ONE definition of the points scale +
 * bands. rubric.ts and points.ts re-export from here; nothing re-derives these values (§2.2 — a duplicated band
 * boundary would drift). rubric.test.ts pins BANDS as contiguous over 0..100.
 */

/** Points scale. A per-session total is 0..POINTS_SCALE_MAX. */
export const POINTS_SCALE_MAX = 100;

/** Manager "strong session" alert fires at/above this (RUBRIC-SPEC 8 — the 80% band the founder described). */
export const STRONG_SESSION_THRESHOLD = 80;

/** Bands (RUBRIC-SPEC 6, scaled to 0–100). Stored on the ledger row's detail so changing boundaries later never
 *  silently rewrites past rows. */
export type PointsBand = "elite" | "strong" | "solid" | "developing" | "needs_coaching";

export const BANDS: ReadonlyArray<{ band: PointsBand; min: number; max: number; label: string }> = [
  { band: "elite", min: 90, max: 100, label: "Elite" },
  { band: "strong", min: 80, max: 89, label: "Strong" }, // manager alert line
  { band: "solid", min: 60, max: 79, label: "Solid" },
  { band: "developing", min: 40, max: 59, label: "Developing" },
  { band: "needs_coaching", min: 0, max: 39, label: "Needs coaching" },
] as const;

/** band → display label (derived from BANDS so the two never diverge). */
export const BAND_LABEL: Record<PointsBand, string> = Object.fromEntries(
  BANDS.map((b) => [b.band, b.label]),
) as Record<PointsBand, string>;

/** Classify a 0..100 total into its band (BANDS is contiguous + covers the range — pinned by rubric.test.ts). */
export function bandFor(points: number): PointsBand {
  const clamped = Math.max(0, Math.min(POINTS_SCALE_MAX, Math.round(points)));
  const hit = BANDS.find((b) => clamped >= b.min && clamped <= b.max);
  return hit!.band; // BANDS covers 0..100 with no gap (tested), so this is always defined
}

/**
 * `bandFor`, for a value that arrived over the wire.
 *
 * WHY IT IS SEPARATE FROM `bandFor`. That one takes a number and is right to: every caller inside the scoring code
 * already has one. This is for the boundary where a value comes back from PostgREST, where two things are true
 * that are not true anywhere else:
 *
 *   `avg_points` is a `numeric`, and PostgREST serialises numeric as a STRING to preserve precision. So the value
 *   is "89.6" rather than 89.6, and every comparison in the caller silently coerces — which works right up until
 *   someone compares it to another string.
 *
 *   It can be absent. `bandFor(undefined)` does not return a sensible band, it THROWS: `Math.round(undefined)` is
 *   NaN, no band's range contains NaN, and the non-null assertion on the lookup then dereferences undefined. A
 *   board row with no average would take the whole Scoreboard down.
 *
 * An unreadable average bands as the lowest rather than throwing, because a chip is not worth a blank screen — and
 * a rep with no scored session is genuinely not in a higher band.
 */
export function bandForWire(value: number | string | null | undefined): PointsBand {
  const n = typeof value === "string" ? Number(value) : value;
  return bandFor(typeof n === "number" && Number.isFinite(n) ? n : 0);
}
