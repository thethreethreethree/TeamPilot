# BUILD — /finalize server-side idempotency

### finalize route — skip the 5-engine generation when the dissect already landed
read-path: `src/app/api/coach/sales-session/[id]/finalize/route.ts` reads (RLS) whether a
`coach.dissect_generated` event exists for `sales_session:<id>` before generating.
write-path: on a first finalize (no marker) it still appends the transcript AND runs
`generateSessionArtifacts` (the five engines) as before; on a repeat (marker present) it appends the transcript
(idempotent on seq) and returns `{ alreadyGenerated: true }` WITHOUT re-charging the five engines. A FAILED first
generation leaves no marker, so a legitimate retry still runs.

## Test coverage
`src/app/api/coach/sales-session/[id]/finalize/__tests__/route.test.ts`:
- the owner happy-path now also asserts `runAndStoreDissect` runs once (first finalize generates);
- a new case sets a prior `coach.dissect_generated` and asserts `runAndStoreDissect` is NOT called and the
  response is `alreadyGenerated:true` (the re-charge is skipped). The events-marker read is mocked on the
  supabase client.

## Out of scope (deferred — finding ④ retranscribe, see think.md §Out of scope)
`/retranscribe` idempotency needs new persisted state (a cached diarization result or a per-session auto-fire
marker = a migration), since its result is ephemeral and it is re-runnable by design. Flagged for a dedicated
build.
