# BUILD — latest-summary-per-session dedup

### The shared dedup helper
- write-path: `compute.ts latestSummaryPerSession(rows)` — collapse append-only after_pitch_summaries to the
  latest row per session by created_at (last-seen wins on tie/absent).
- read-path: any payload-derived metric now iterates one row per session — each call counted once.

### Both KPI readers use it
- write-path: `me/route.ts` + `team/route.ts` — select `created_at`; run `latestSummaryPerSession` on the paged
  after_pitch_summaries before building layer3 / objection / recommendation / quality inputs.
- read-path: Layer-3 sample sizes + objection/uptake counts reflect real distinct calls, not re-generations.

## Files
- `src/lib/coach/kpi/compute.ts` — latestSummaryPerSession + test (+2 cases)
- `src/app/api/coach/kpi/me/route.ts` — created_at + dedup
- `src/app/api/coach/kpi/team/route.ts` — created_at + dedup

## Ripple (§6 item 5)
- Read-side only; no schema, no write. The recommendation-uptake metric already deduped internally (now belt-and-
  suspenders). Values keyed on identical re-gen payloads are unchanged; the fix corrects the SAMPLE SIZE (and thus
  the Understanding-Gate threshold) that the double-count had inflated. Prerequisite for a safe objection backfill.

## Honest limit (verify)
- The helper + the collapse are unit-gated + typechecked. The end-to-end effect (a re-generated session counting
  once on the live page) is founder visual-verify, but the logic is pure and tested.
