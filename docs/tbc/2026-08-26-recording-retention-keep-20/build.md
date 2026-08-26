# BUILD — recording retention: keep each rep's last 20

### age rule → per-rep count rule
- write-path: `recording-purge-cron/route.ts` — replaced RETENTION_DAYS=2 + the `.lt(created_at, cutoff)` query with
  KEEP_PER_REP=20. Fetch all purge-eligible recordings (audio not null, recording_saved=false) NEWEST-first via
  `fetchAllPaged` (cap-safe); group by agent_id; the first 20 stay, the rest are "beyond window"; purge oldest-first,
  capped at BATCH=500. Response swaps `retentionDays` → `keepPerRep` + `candidates`/`beyondWindow` counts.
- read-path: each rep always retains their 20 most-recent recordings — a manager can pull recent recordings even from
  a rep who hasn't pitched in days. Older recordings drop (bytes + pointer), transcript/scores kept.

Preserved invariants (unchanged, not new elements): the malformed-pointer guard (never null-and-count a pointer whose
object can't be verified gone — the false-ok class this cron must never have), the chunk cleanup, the saved-recording
exemption, and the honest `bounded` flag all stay exactly as before — only the SELECTION rule (age → per-rep count) changed.

## Files
- `src/app/api/coach/sales-session/recording-purge-cron/route.ts` — count-based selection (fetchAllPaged) + response.
- `src/app/api/coach/sales-session/recording-purge-cron/__tests__/route.test.ts` — mock `.range()`; purge-beyond-20 + malformed-beyond-20.
- `src/app/api/coach/sales-session/__tests__/recording-purge-cron.route.test.ts` — same mock update + 21-row fixtures.

## Ripple (holistic — §6 item 5)
- Selection-only change; auth/storage-removal/chunk-cleanup/malformed-guard untouched. No schema change.
- Candidate set is bounded (only sessions with audio) and self-limits toward ≤20/rep + a shrinking tail.
- 9 purge-cron tests pass across both files; typecheck clean.

## Honest limit
Applies going forward — recordings already deleted by the old 2-day rule are gone (can't be resurrected). The rolling
20-window now accrues for NEW recordings. `bounded:true` on the first runs is expected while any initial backlog drains.
