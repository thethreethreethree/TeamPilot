# CLOSURE — Honest post-meeting recording state + KPI read error (audit M4 + L1)

## What shipped
M4: the meeting-ended screen no longer promises a review over a recording that may not have saved. The hook tracks
whether audio is durable (a landed chunk or a successful clean-Stop persist) and exposes `recordingSaved`; the
panel renders honest copy from a pure, gate-tested helper (`warn` when nothing saved, "ready" when durable,
"saving now" only while in flight). L1: a KPI read error now returns a 502 (generic message) instead of a
fabricated `0/0/0/0` strip; the client keeps its last good values. No schema change. Full `npm run check` exit 0.

**This closes the reliability audit** (`docs/RELIABILITY-AUDIT-2026-08-22.md`): all HIGH (H1-H4) + all MED (M1
mitigated, M2/M3 shipped, M4 here) + L1 here. **L2 is the sole deferred item.**

## The un-named reliance
- **M4's `recordingSaved` derivation is MediaRecorder-callback-bound** (mic glue), verified on-device — the pure
  copy helper is the tested part. The hook must stay mounted across the end transition for the value to reach the
  ENDED screen (it does — the panel calls the hook with `""`, not unmount).
- **L1 relies on the client's best-effort `loadKpi` keeping prior state** on a 502 (it only `setKpi` on `res.ok`).

## Residual (A36)

```json
[
  {
    "id": "l2-pitch-duration-wall-clock-deferred",
    "item": "Pitch analysis feeds the client wall-clock durationMs into the prompt, not the real audio length.",
    "why_skipped": "LOW blast-radius (colors a prompt note, not a displayed metric); the proper fix needs word-timestamp plumbing the pitch STT path (transcribeSpeech, text-only) doesn't expose — a larger change than the finding warrants. Tracked in the audit doc.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T03:20:00+08:00",
    "outcome": "Deferred; the only open audit item."
  },
  {
    "id": "m4-recordingSaved-glue-untested",
    "item": "The MediaRecorder/persist code that SETS recordingSaved is not unit-tested (mic glue).",
    "why_skipped": "Established device-confirmed-untestable pattern for this hook; the honest-copy decision (the part that regresses silently) is extracted to a pure, tested helper.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T03:20:00+08:00",
    "outcome": "Copy gated by a pure test; glue confirmed on-device at go-live."
  }
]
```
