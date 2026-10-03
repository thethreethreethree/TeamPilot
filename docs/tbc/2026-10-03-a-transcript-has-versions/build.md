# BUILD - a transcript has versions

### Versions in the database

- **write-path:** `supabase/migrations/0269_transcript_versions.sql`.
- **read-path:** `scripts/sql/probes/0269-transcript-versions.sql` (migration audit PASS 3).

### Every website read takes the current version

- **write-path:** 13 reads switched to `coaching_transcript_segments_current` (calibration, kpi me/team, segments,
  capture-health, pitch-score backfill, readRecordings, dissectBackfill, transcriptRecovery, transcriptRecoverySweep,
  salesCoach x2, vendorMonitoring); tests' table mocks follow.
- **read-path:** `scripts/invariant-audit.mjs` INVARIANT 32.

### A relabel is a new version

- **write-path:** `src/app/api/coach/sales-session/[id]/attribute-unlabelled/route.ts` calls relabel_session_transcript.
- **read-path:** its `__tests__/route.test.ts` (the call and its arguments; never a direct table write).

### The app reads the current version

- **write-path:** app `src/lib/sync/sessions.ts` (transcript, "who spoke?" count, embedded segment count).
- **read-path:** app `tests/transcript-current-version.test.ts`.
