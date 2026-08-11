# BUILD — Uploaded recording shows its real audio length

### Real audio-length duration for uploaded recordings — every surface (§1.5.1 holistic)
The duration reflects the recording's actual length instead of the session wall-clock across ALL THREE
places it appears — After-Pitch header, the Sessions list, and the KPI average-session-duration metric — so
the same upload can't read 4m in one place and 62m in another.

- **write-path:** `transcribeWithDiarization` now returns `{ segments, durationSeconds }` where
  `durationSeconds` = the last spoken word's `end` (fallback `start`), rounded. On a successful transcription,
  `upload-recording` (JSON finalize + multipart branches) and `retranscribe` issue a best-effort service-role
  update stamping `coaching_sessions.audio_duration_seconds` (column added by migration **0210**, additive +
  nullable), scoped `.eq("id")`+`.eq("company_id")`. The update is UNCHECKED (A34: if the column were absent it
  silently no-ops, never throws); the migration is applied before deploy regardless.
- **read-path:** `getSession`'s `.select("*")` + `mapSession` expose `audioDurationSeconds` (null-safe: null
  when the column is absent OR when a live session never set it); `GET /api/coach/sales-session/[id]` returns it
  in `session`. All three consumers PREFER the audio length when present and fall back to the `started..ended`
  wall-clock for live sessions (correct there), returning null/"—" when neither is known (no fabricated number,
  §3.4): After-Pitch `durationLabel`, the Sessions list `duration()` (list route select + map extended), and
  the KPI `avgSessionDurationMin` (compute-cron + me + team selects/maps + `KpiSessionRow` extended).

## Files touched
- NEW `supabase/migrations/0210_coaching_session_audio_duration.sql` — nullable `audio_duration_seconds`.
- `src/lib/care/voice/elevenlabs.ts` — `transcribeWithDiarization` returns `{ segments, durationSeconds }`.
- `src/app/api/coach/sales-session/[id]/upload-recording/route.ts` — stamp duration (both branches).
- `src/app/api/coach/sales-session/[id]/retranscribe/route.ts` — stamp duration (+ admin client import).
- `src/lib/data/salesCoach.ts` — `SalesSession.audioDurationSeconds` + mapper.
- **Display + metric (holistic):** `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` (durationLabel),
  `src/app/dashboard/sales-coach/sessions/page.tsx` (duration helper + Row type),
  `src/app/api/coach/sales-session/list/route.ts` (select + map),
  `src/lib/coach/kpi/compute.ts` (`avgSessionDurationMin` + `KpiSessionRow`),
  `src/app/api/coach/kpi/{compute-cron,me,team}/route.ts` (select + map).
- Tests: new transcription return shape + duration-stamp assertions (upload-recording, retranscribe); KPI
  `avgSessionDurationMin` prefers-audio-length test.
