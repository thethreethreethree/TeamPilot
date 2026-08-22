# BUILD — Honest post-meeting recording state + KPI read error (audit M4 + L1)

### the meeting-ended screen tells the truth about the recording (M4)
- write-path: `postMeetingAudioChunk` resolves `true` iff a chunk landed; the hook counts landed chunks
  (`chunkOkRef`) and, in `rec.onstop`, sets `recordingSaved` — `true` if the full-blob `persistRecording` succeeds
  OR a chunk landed, `false` when a Stopped call saved nothing, `null` while in flight. Reset on a fresh start.
- read-path: `MeetingCoachingPanel`'s ENDED screen renders from the pure `meetingEndedRecordingCopy(recordingSaved)`
  helper — a WARN ("review may be unavailable") when false, "review is ready" when true, "saving now" only while
  null. The hook stays mounted across the `sessionId→null` transition, so the value survives + updates reactively.

### a KPI read error is a 5xx, never a fabricated 0 (L1)
- write-path: `getKpiForDay` now classifies the Supabase `error` (throws) instead of `return data ?? []`.
- read-path: the GET route catches it → 502 with a generic message (CWE-209); the client's best-effort `loadKpi`
  keeps its last good strip rather than blanking to `0/0/0/0`.

## Files
- `src/lib/coach/v5/useMeetingCoaching.ts` — chunk-landed tracking, `recordingSaved` state, honest onstop.
- `src/components/sales-coach/MeetingCoachingPanel.tsx` — pure `meetingEndedRecordingCopy` + ENDED-screen wiring.
- `src/lib/data/doorlog.ts` — `getKpiForDay` throws on error.
- `src/app/api/coach/sales-session/door-log/route.ts` — GET catches the KPI read error → 502.
- `docs/RELIABILITY-AUDIT-2026-08-22.md` — status: all HIGH + MED closed; L2 deferred.
- tests: `meetingEndedRecordingCopy.test.ts` (3 states); door-log `route.test.ts` (+3: KPI error → 502, KPI
  success → totals, empty storagePath → 400 [M3 behavioral]).

## Ripple (holistic)
No schema change. M4 touches only the meeting hook/panel (unwired MVP). L1's throw is caught at the single GET
consumer; the client already treated the strip as best-effort. L2 deferred (needs Scribe-timestamp plumbing).
