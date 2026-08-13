# CHECK — STT-capture instrumentation

## Verification run (A38)
Canonical command: `npm run check`.

## Findings

### F1 — capture-health UNDERCOUNTED the no-feedback cost (missed one-sided captures)
file+line: `src/app/api/coach/sales-session/capture-health/route.ts` — the prior version counted a session as
"captured fine" if it had ANY transcript segment, so a ONE-SIDED capture (customer segments present, 0 agent
turns) was counted as fine despite yielding no "Your read" (the review engine short-circuits at
agentSegments < MIN_AGENT_SEGMENTS).
class: silent-undercount (a metric reporting a guessed-low number — §3.4).
severity: medium
read-path: fixed by keying "captured" on an AGENT segment; adds `noFeedback` (empty + one-sided), `oneSided`,
and a per-agent breakdown.
remediation: see remediate.md F1.
sweep-command: `grep -nE "withAgentSegment|oneSided|noFeedback|speaker" src/app/api/coach/sales-session/capture-health/route.ts`
— confirms the count keys on agent turns and splits the failure modes.

## Not a defect — instrumentation added
The per-session `[stt-capture]` log in afterPitch.ts is additive telemetry (no behavior change). It confirms the
STT-zero-turns hypothesis at the feedback point and surfaces `oneSided` per session.

## Tests
```
$ npx vitest run src/app/api/coach/sales-session/capture-health/__tests__/route.test.ts \
    src/lib/coach/v5/__tests__/afterPitch.generate.test.ts
 Test Files  2 passed (2)   ·   Tests  8 passed (8)
```
capture-health test now covers: captured-fine (has agent turn), one-sided (customer-only), empty (no segment),
the true `noFeedback` count, and per-agent rates (worst-first). afterPitch's generate suite still passes 4/4 (the
log didn't change its output).

## Full gate
```
PENDING — pasted in closure after the run
```
