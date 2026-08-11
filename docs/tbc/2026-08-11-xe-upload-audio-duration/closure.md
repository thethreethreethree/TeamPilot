# CLOSURE — Uploaded recording shows its real audio length

## What shipped
Migration 0210 adds nullable `coaching_sessions.audio_duration_seconds`. `transcribeWithDiarization` returns
the real audio length from the Scribe word timestamps; `upload-recording` (both branches) + `retranscribe`
stamp it. All three duration surfaces — After-Pitch header, Sessions list, KPI `avgSessionDurationMin` — now
PREFER it, falling back to the `started..ended` wall-clock only for live sessions (correct there). The founder's
"62m 47s for a 4-minute clip" reads its real length; live-coaching durations are unchanged.

## Un-named reliances (A35 — name them)
- **Scribe returns per-word timestamps.** The whole length depends on `words[].end`/`start` in the STT
  response. If a future model/response drops them, `durationSeconds` is 0 → not stamped → the consumers fall
  back to the wall-clock (degrades honestly, never a fake number).
- **The migration is applied BEFORE the code deploys.** The Sessions-list + KPI selects name
  `audio_duration_seconds` explicitly (not `.select("*")`), so they are migration-coupled: a missing column
  would degrade the list to `{degraded:true}` and error the KPI select. Applied via `db:apply` (DB at 0210)
  first; the session READ (`getSession`) uses `.select("*")` and is null-safe regardless (A34).
- **The stamp is best-effort + unchecked.** `await admin...update(...)` ignores its error, so a failed stamp
  silently no-ops rather than failing the upload (the transcript already succeeded — the length is secondary).

## Residual (A36 — ranked by confidence-it-does-not-matter; top must be OPENED)
```json
[
  { "id": "R1", "item": "Any OTHER surface that computes a duration from started_at..ended_at and would also be wrong for uploads.", "why_skipped": "Grepped every started_at/ended_at consumer. Only three compute a duration (After-Pitch, Sessions list, KPI) — all fixed. salesElo.ts selects the timestamps but uses them for event ORDERING/replay, not a duration, so it needs no change.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T14:55:00Z", "outcome": "Confirmed the three fixed surfaces are the complete set of duration consumers; salesElo is ordering-only. No further surface to fix." },
  { "id": "R2", "item": "Backfill of the real length for sessions uploaded BEFORE 0210.", "why_skipped": "Pre-0210 uploads have audio_duration_seconds = null and keep the old wall-clock. No backfill job written — historical rows are low-value and the founder's test row can simply be re-transcribed if its number matters.", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R3", "item": "Trailing silence after the last spoken word isn't counted in the length.", "why_skipped": "durationSeconds is the last word's end. Trailing silence is negligible for a call and the result is vastly more honest than the session open-time; not worth measuring the raw container length.", "confidence_it_does_not_matter": "low", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Files scanned: 766 · Violations: 0
tbc ✓ — docs · manifest · artifacts · residual · freshness all ✓
test ✓ — Test Files 385 passed | 1 skipped (386); Tests 2660 passed | 15 skipped (2675)
CHECK_EXIT=0
```
