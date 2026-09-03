# CHECK — Gamification Phase 3 (wire + backfill)

## Tests: `npx vitest run generateAndStoreAfterPitch.test.ts src/lib/coach/gamification/`
```
 Test Files  4 passed (4)
      Tests  22 passed (22)
```
Includes the new drift-guards: the wire calls bankSessionPoints("s1") on a signal summary; does NOT call it on a
thin (hasSignal:false) summary; and a rejected bankSessionPoints never sinks the after-pitch save (still generated).

## Typecheck: `npm run typecheck` → clean (exit 0).

## Live seed (the real command + evidence)
`node scripts/seed-gamification-points.mjs --apply`:
```
APPLIED: scanned 137 scored sessions → 131 banked, 0 already-had-a-row, 6 not-scoreable (banked nothing)
```
`node scripts/diag-ledger-count.mjs`:
```
ledger rows: 131; agents on the board: 9; top totals: 3604, 1036, 548, 480, 469
```
Re-running the seed is a no-op (idempotent — the 131 now show as already-had-a-row).

## Findings
- No findings. The wire is best-effort (cannot break the review), fires from the one shared sequence (both callers),
  and is drift-guarded; the backfill is idempotent and reuses existing scores (no LLM cost).

## Not claimed
- The wire ships in code and takes effect on deploy (the branch isn't deployed yet); the seed already ran on the
  live DB, so the board is populated now regardless.
- Notifications (Phase 4) + the leaderboard UI (Phase 5) are not built — the ledger is populated but has no surface yet.
