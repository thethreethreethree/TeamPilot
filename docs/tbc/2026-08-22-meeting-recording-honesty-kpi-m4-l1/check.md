# CHECK — Honest post-meeting recording state + KPI read error (audit M4 + L1)

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  560 passed | 1 skipped (561)
      Tests  3688 passed | 15 skipped (3703)
EXIT: 0
```

(Targeted: meetingEndedRecordingCopy 3, door-log route 10 — pass.)

## What the tests prove
- **M4:** `meetingEndedRecordingCopy` returns a WARN with no false promise when `recordingSaved===false`, "ready"
  when true, and "saving now" only when null — so the ENDED copy can't silently regress to the old unconditional
  promise. (The MediaRecorder/persist glue that sets `recordingSaved` follows the established
  device-confirmed-untestable pattern; the honest-copy DECISION is the pure, gated part.)
- **L1:** the GET route returns 502 (with an error, NOT a zeroed strip) when `getKpiForDay` throws, and the summed
  totals on success.
- **M3 (behavioral):** a pitch POST with an empty `storagePath` and no recordingId → 400, never a doomed pitch.

## Honest limit
`recordingSaved`'s derivation lives in MediaRecorder callbacks (mic glue), confirmed on-device rather than in
jsdom — same treatment the meeting hook has always had. L2 is deferred (see the audit doc).

## Findings
**No findings.** No schema change; M4 is on the unwired meeting MVP; L1's throw is caught at its single consumer.
