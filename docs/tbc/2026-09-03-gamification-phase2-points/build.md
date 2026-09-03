# BUILD — Gamification Phase 2 (points mapping)

### The pure mapping
- write-path: `src/lib/coach/gamification/points.ts` — `computeSessionPoints(ScoreCategory[])` → { points 0–100,
  band, dimensions } or null; `bandFor(points)`. No I/O. Rounds half-up.
- read-path: given the existing after-pitch scores, returns the banked total + band, or null for a not-scoreable
  session — the caller banks nothing then.

### The orchestrator (the only DB side effect)
- write-path: `src/lib/coach/gamification/bankPoints.ts` — `bankSessionPoints(sessionId)` reads the after-pitch
  scores (service-role), maps them, inserts one session_score ledger row; idempotent on the unique index
  (already_banked), honest empties (no_after_pitch / not_scoreable), real errors propagate.
- read-path: Phase 3 will call this on session-end; it banks at most once per session, reports whether the session
  crossed the strong threshold (for Phase 4's notification).

## Files
- `src/lib/coach/gamification/points.ts` (NEW) + `__tests__/points.test.ts` (NEW)
- `src/lib/coach/gamification/bankPoints.ts` (NEW) + `__tests__/bankPoints.test.ts` (NEW)

## Ripple (§6 item 5)
- No schema change, no migration. Reads existing after_pitch_summaries; writes only the Phase-1 ledger.
- No wiring yet — nothing calls bankSessionPoints automatically until Phase 3 (deliberate separation, so the mapping
  can be reviewed before it writes to real agents' ledgers).
- Reuses the single-source constants from rubric.ts (scale, threshold, bands, counted dimensions).
