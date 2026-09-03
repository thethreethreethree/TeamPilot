# BUILD — Gamification Phase 3 (wire + backfill)

### The wire
- write-path: `src/lib/coach/v5/generateAndStoreAfterPitch.ts` calls `bankSessionPoints(sessionId)` immediately
  after `saveAfterPitchSummary`. Best-effort (try/catch, logged), idempotent, no LLM.
- read-path: when a session's after-pitch review generates (on-view OR the recovery backfill — the one shared
  sequence), its points bank automatically; a failure logs and never breaks the review.

### The backfill
- write-path: `src/lib/coach/gamification/bankPoints.ts` gains `backfillSessionPoints()` (banks every summarized
  session lacking a ledger row; idempotent). `scripts/seed-gamification-points.mjs` is the one-time live seed.
- read-path: the leaderboard is populated from the already-scored sessions on day one (131 rows seeded, 9 agents).

### Drift-guards
- write-path: `src/lib/coach/v5/__tests__/generateAndStoreAfterPitch.test.ts` — the wire fires on a signal summary,
  does NOT fire on a thin one, and a bank failure never sinks the save.
- read-path: the suite FAILS if a refactor drops the bankSessionPoints call → the wire can't silently disappear
  (points would stop banking on new sessions without any test going red otherwise).

## Files
- `src/lib/coach/v5/generateAndStoreAfterPitch.ts` (wire), `src/lib/coach/gamification/bankPoints.ts` (backfill fn)
- `src/lib/coach/v5/__tests__/generateAndStoreAfterPitch.test.ts` (wire drift-guards)
- `scripts/seed-gamification-points.mjs`, `scripts/diag-gamification-dryrun.mjs`, `scripts/diag-ledger-count.mjs`

## Ripple (§6 item 5)
- The after-pitch flow gains one best-effort call; on failure it logs and continues (the review is unaffected).
- Both after-pitch callers (route + recovery backfill) now bank — no second trigger, no drift (A16 one sequence).
- The seed reuses existing scores (no LLM/STT cost) and is idempotent (skips already-banked, catches 23505).
- The wire ships in code (deploys with the branch); the seed already ran against the live DB.
