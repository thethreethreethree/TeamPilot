# BUILD — After-Pitch first-visit recovery + transient-failure marker release

### generate() returns the fresh summary (enables first-visit recovery)
read-path: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` `generate()` now returns
`Promise<Summary | null>` — the freshly-built After-Pitch summary (null on latch-skip/error/403).
write-path: unchanged — it still POSTs `/after-pitch` (builds + persists the summary + its KPI event); the
return is additive so existing callers (manual button, the "recovered" path) are unaffected.

### load() engages auto-recover from the FRESH summary on first visit
read-path: same page's `load()` heal branch: after `const fresh = await generate()`, if `!isVideoSession &&
afterPitchNeedsAutoRecover(fresh, hasSavedRecording)` and the marker latch is free, it fires `autoRecover()`.
write-path: `autoRecover()` POSTs `/auto-recover` (server re-diarizes + atomically replaces the transcript). The
change makes a customer-missing FIRST visit recover without a second mount — previously only a stored (blank)
summary triggered it, stranding Standard reps.

### auto-recover route releases the marker on a transient replace failure
read-path: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts` — the `!replaced.ok` branch.
write-path: now `await releaseMarker()` (sets `auto_recover_attempted_at` back to null) before the 500, matching
the route's transient-vs-definitive doctrine and the download/STT 502 paths. A rolled-back DB write no longer
permanently burns automatic recovery.

## Test coverage
- `src/app/api/coach/sales-session/[id]/auto-recover/__tests__/route.test.ts`: the admin mock now captures every
  `.update({...})` payload; the replace-failure test asserts `markerWasReleased()` — removing the release
  reddens CI (A30).
- `captureGap.test.ts` already locks `afterPitchNeedsAutoRecover(customerMissing, true) === true` (the predicate
  the first-visit fix feeds the FRESH summary into). The client wiring itself follows the repo convention (0
  `*.test.tsx`); a browser repro is noted as residual.

## Out of scope (deferred — findings ⑥ + ⑧, see think.md §Out of scope)
Server-side After-Pitch refresh after a lost client `generate()` (⑥) and persisting a single-voice decline
reason to stop the reload re-transcribe loop (⑧) are flagged for a dedicated build.
