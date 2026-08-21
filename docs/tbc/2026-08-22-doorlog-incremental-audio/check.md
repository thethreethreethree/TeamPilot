# CHECK — DoorLog incremental audio upload + wake lock

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  552 passed | 1 skipped (553)
      Tests  3635 passed | 15 skipped (3650)
EXIT: 0
```

All gates exit 0 (typecheck, lint, theme:audit, tests, tbc, invariant-audit). 70 existing doorlog tests still
pass (additive, no regression).

## What the tests DO prove
- Storage layout + `recordingIdFromAudioPath` + `isValidRecordingId` (pure) — the single source can't drift and
  can't smuggle a path segment.
- The chunk route boundary — 401 / 403-no-company / 400-bad-rid / 400-bad-seq / 400-empty / happy-path
  company-pinned write.
- The consumer routing — a recording that streamed chunks saves by `recordingId` and NEVER runs the single-blob
  sign+upload; no red failure banner.

## What the tests CANNOT prove (honest limit — A38)
A real browser MediaRecorder streaming chunks over a **throttled/dropping connection**, and the **screen wake
lock**, cannot be exercised headless. That is the founder's on-device verification (protocol in closure.md). I do
NOT claim this "proven fixed" until that runs.

## Findings
**No findings.** The change is traced to a DB-proven cause, reuses tested live-path helpers, and is additive with
the single-blob fallback + disposition-save preserved.
