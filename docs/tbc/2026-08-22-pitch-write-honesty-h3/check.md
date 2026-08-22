# CHECK — Pitch worker: derived-table write honesty (audit H3)

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  559 passed | 1 skipped (560)
      Tests  3677 passed | 15 skipped (3692)
EXIT: 0
```

(Targeted suites: doorlog.writeHonesty 4, worker 11, PitchDetail 4 — all pass.)

**Honest note.** Two earlier full-run attempts showed the documented self-spawning-audit timeout flake
(`invariant-audit.test.ts > "the whole tree currently passes reachability"` execFileSyncs a fresh
`node scripts/invariant-audit.mjs` and, under full-suite parallel load, the subprocess is I/O-starved past its
timeout — the failure mode its own line-29 comment warns of). It passes standalone (41/41), the script reports
`Violations: 0`, and the clean run above is green. Not related to this change.

## What the tests prove
- **Data layer (new file):** each of `writePitchTranscript` / `writePitchAnalysis` / `setPitchStatus` **throws**
  on a Supabase error (`"<op> failed: <message>"`) and **resolves** on success. This is the honesty the swallow
  hid.
- **Worker:** when `writePitchAnalysis` throws, `processPitch` **never** calls `setPitchStatus("complete")` — the
  catch routes it to a non-terminal backoff for the cron. No hollow complete.
- **UI:** a `complete`-with-null-analysis pitch renders **"Analysis unavailable"** (not "Still processing…"),
  and the transcript still shows; the forever-spinner falsehood is gone.

## Honest limit
The real transient DB failure can't be reproduced live; it's simulated by a mock returning `{ error }`, which is
exactly the shape supabase-js hands back. `recordFailureStatus` swallowing a persist error is verified indirectly
(the worker keeps its "never throws" contract in the existing suites).

## Findings
**No findings.** No schema change, no migration; the three helpers are worker-only; retries idempotent. Class
noted: INV22 guards the catch-swallow variant — these had no catch, now closed.
