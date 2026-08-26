# BUILD — P1: content-aware "Generate missing" (exclude empty captures)

### the content-aware split in the shared backfill core
- write-path: `dissectBackfill.ts` — after computing `missingAll` (ended/reviewed, no dissect, not backed-off), a
  bounded `fetchAllPaged` query over `coaching_transcript_segments` for the missing ids yields the set WITH content.
  `missing` = has-content; `noContent` = the rest (0-segment empty captures). Batch draws from `missing` only; result
  gains a `noContent` field (type + emptyResult updated).
- read-path: a 0-segment session is never batched (no wasted 5-engine LLM call), never counted as recoverable; the
  manager's "remaining" reflects real recoverable sessions and each click generates up to 4 of them.

### the honest manager message
- write-path: `coach-assessment/page.tsx` — the "Generate missing" result message appends
  `· N sessions had no audio captured (nothing to assess)` when `noContent > 0`, and says "still to generate" not
  "still missing".
- read-path: the manager sees progress + WHY the count isn't fully recoverable, instead of a frozen "0 generated".

## Files
- `src/lib/coach/v5/dissectBackfill.ts` — content-aware split + `noContent` (shared by the manual button AND the cron).
- `src/app/dashboard/sales-coach/coach-assessment/page.tsx` — honest message with the noContent count.
- `src/lib/coach/v5/__tests__/dissectBackfill.test.ts` — +2 tests (empty excluded → noContent, no LLM; all-empty batch).
- diag: `scripts/diag-capture-live.mjs` (reused) established the empty-capture ground truth behind this.

## Data provenance (§0 / instrument-first)
Real transcript-segment counts: 28203036 → 25 recoverable / 82 empty; c3e7f389 → 41 / 62. `getSessionTranscriptAdmin`
reads the same `coaching_transcript_segments`, so 0 segments = no transcript = correctly un-assessable.

## Ripple (holistic — §6 item 5)
- Shared core → the all-company cron gets the same benefit (stops re-checking empty sessions each run).
- The content query is cap-safe (`fetchAllPaged`, not a raw `.select()` that truncates at 1000).
- Additive result field; no schema/route-auth change; 9 existing backfill tests still pass.

## Honest limit
The ~144 EXISTING empty sessions cannot be retro-assessed (there is no audio — the iOS capture bug, fixed today for
NEW sessions). This fix makes that honest and stops it from masquerading as a generatable backlog. It does NOT
auto-run the recoverable 25/41 — the manager's now-working button generates them (4/click); bulk auto-generation is
an LLM-cost decision left to the founder.
