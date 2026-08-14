# CHECK — After-Pitch first-visit recovery + transient-failure marker release

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — customer-missing session does not auto-recover on FIRST visit (Standard reps stranded on a blank read)
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` load()/heal branch × `captureGap.ts:46-51`
(`afterPitchNeedsAutoRecover` requires `!!summary`). First visit → stored summary null → auto-recover skipped →
heal generates a blank read; only a later mount (which Standard reps don't get) would recover.
class: workflow-continuity / error-dressed-as-no-data (the recoverable customer-missing gap silently stays a
blank read for the exact user the recovery exists for).
severity: high (the founder-reported incident class + user; trust-critical).
sweep-command: `grep -n "afterPitchNeedsAutoRecover" src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` —
confirms it is now called with the FRESH generated summary in the heal branch, not only the stored one.
read-path: fixed — `generate()` returns the fresh summary; a fresh customer-missing summary engages auto-recover
in the same load().

### F2 — a transient replaceSessionTranscript failure permanently burns automatic recovery (no marker release)
file+line: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts` (the `!replaced.ok` 500 branch).
class: recovery-idempotency / transient-vs-definitive (a rolled-back DB write is transient but was treated as a
definitive outcome, keeping the at-most-once marker set forever).
severity: medium (a momentary DB blip permanently disables the automatic path for that session).
sweep-command: `grep -n "releaseMarker()" src/app/api/coach/sales-session/[id]/auto-recover/route.ts` — the
release is now on the download 502, STT 502, AND the replace-failure paths (the three transient outcomes).
read-path: fixed — `await releaseMarker()` before the replace-failure 500.

## Class sweep (A26)
Swept the auto-recover route's failure branches: download 502, STT 502, and replace-failure are all TRANSIENT and
now all release the marker; the DEFINITIVE outcomes (recovered / single-cluster / ambiguous / bad-pointer) keep
it — consistent with the route's stated doctrine. The two SAME-flow MED findings (⑥ lost-refresh stale read, ⑧
single-voice reload loop) are flagged for a focused follow-up (they need new persisted server state).

## Tests
```
$ npx vitest run auto-recover captureGap
 Test Files  2 passed (2)
 Tests  21 passed (21)
```
The route test now asserts the marker is released on a replace failure; captureGap locks the customer-missing
predicate the first-visit fix relies on. Full gate + exit code in closure.md.
