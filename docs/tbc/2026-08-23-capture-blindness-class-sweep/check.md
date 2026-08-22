# CHECK — Capture-blindness class sweep

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  564 passed | 1 skipped (565)
      Tests  3700 passed | 15 skipped (3715)
EXIT: 0
```

(Targeted: captureDiag 2, coach capture-diag route 6, recorder-adjacent suites 80 files / 584 tests pass — no regression.)

## What the tests prove
- **buildCaptureDiag (pure):** safe defaults for everything omitted; carries the observed cause + the track
  readyState — the one consistent shape every recorder reports.
- **Generic endpoint gate:** requires auth (401) + a company context (403); appends `coach.capture_failed` with
  `company_id` PINNED (INV15), `surface` tagged, and the subject scoped to the session (`coaching_session:<id>`) or
  the rep (`rep:<user>`) when no sessionId; rejects an unknown surface / malformed body (400).
- **No regression:** the live / meeting / C.A.R.E-adjacent suites (80 files, 584 tests) pass unchanged with the
  instrumentation added.

## Honest limit
The recorders' observation code (MediaRecorder `onerror` + mic-track `ended`/`mute`) is mic glue — it runs
on-device, not in jsdom; the tests exercise the shared primitive + the endpoint. This makes each recorder's
failure OBSERVABLE; it does not assert which cause dominates — that follows from the `coach.capture_failed` events.

## Findings
**No findings.** Additive; existing paths byte-unchanged; endpoint auth+company-pinned; best-effort. With this the
capture-blindness class (A26) is swept across all four recorders (DoorLog + these three).
