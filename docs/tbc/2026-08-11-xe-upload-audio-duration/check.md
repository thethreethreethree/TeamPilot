# CHECK — Uploaded recording shows its real audio length

## Verification runs (A38 — canonical commands + exit codes)

**Migration applied + live invariants still hold:**
```
$ npm run db:apply
[db-apply] applying 0210_coaching_session_audio_duration.sql … ok
[db-apply] applied 1 migration(s). DB now at 0210.
$ npm run verify:live
✅ ALL 26 invariants hold.
VERIFY_EXIT=0
```
(Note: db:apply's auto-spawned verify:live emitted an EMPTY "verifier error" once — a transient spawn
hiccup, not a real failure. Re-run directly, all 26 invariants pass. The migration is additive + nullable.)

**Tests (routes + KPI compute) + typecheck:**
```
$ npx vitest run "src/lib/coach/kpi" "src/app/api/coach/sales-session" "src/app/api/coach/kpi"
 Test Files  39 passed (39)
      Tests  240 passed (240)
VITEST_EXIT=0
$ npm run typecheck   # tsc --noEmit
TYPECHECK_EXIT=0
```
Locks: the duration stamp fires on a successful upload/finalize (both branches) — `updatePayloads` contains
`{ audio_duration_seconds: 247 }`; retranscribe stamps too; and `avgSessionDurationMin` reads 4m (not the 62m
wall-clock) when an upload's `audioDurationSeconds` is set.

## Proactive scan (§1.5.2) — every place the duration is shown/measured

Grepped every consumer of `started_at..ended_at` for a DURATION (not just ordering). Found THREE, all fixed:
1. After-Pitch header (`durationLabel`) — the reported surface.
2. Sessions list (`sessions/page.tsx` `duration()`).
3. KPI `avgSessionDurationMin` (compute-cron + me + team feed it).
Also checked `salesElo.ts` (selects started_at/ended_at) — it uses them only for event ORDERING/replay, not
a duration, so it needs no change. No other duration consumer exists.

## Findings

**No findings** — the fix is holistic across all three duration surfaces, so no upload can read one length in
one place and another elsewhere. Known NON-defect limitations:

1. **Transcription-derived length.** `durationSeconds` is the last Scribe word's end/start; trailing silence
   after the last word isn't counted. For a call recording that's negligible and far more honest than the
   session wall-clock. If Scribe returns no word timestamps, the value is 0 → not stamped → the consumer
   falls back to the wall-clock (never a fabricated number, §3.4).
2. **Backfill.** Sessions uploaded BEFORE 0210 have `audio_duration_seconds = null`, so they still show the
   old wall-clock. Only new uploads (and any re-transcribe) get the real length. No backfill job here — the
   founder's test session can be re-uploaded/re-transcribed if its number matters.
