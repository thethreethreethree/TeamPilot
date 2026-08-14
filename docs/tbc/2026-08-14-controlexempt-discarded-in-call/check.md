# CHECK — controlExempt discarded in call()

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — call() discarded the real answer for control-exempt engines on guidance-off companies
file+line: `src/lib/claude.ts` `call()` post-call re-check (was `if (!r.gate.guidanceEnabled)`).
class: duplicated-condition DRIFT — the §3.4 gate condition `!guidanceEnabled && !controlExempt` is authored in
runBrainCall (brain/index.ts) and re-derived in call(); the re-derivation dropped the `controlExempt` term, so
call() suppressed calls runBrainCall had deliberately RUN.
severity: CRITICAL — 100% empty "Your read" (+ 0 live cues) for every company with `ai_guidance_enabled=false`,
while still paying for the LLM call. Confirmed in prod (Deeznuts 13/13, Align 8/8+6/6, Caliber 2/2) and by the
founder's same-device account A/B (Deeznuts empty → Moses admin full).
sweep-command: `grep -rn "gate.guidanceEnabled" src` → 6 re-check sites enumerated; only call() carries
controlExempt callers, and it is now fixed. The rest (rippleTrace/outsideView/chat-streams) are non-exempt and
correct. runBrainStream keeps the term (streaming was never broken).
read-path: fixed — `&& !args.controlExempt` restores the intended exemption at the chokepoint.

## Class sweep (A26)
All `!gate.guidanceEnabled` re-checks reviewed. call() was the only exempt-carrying one with the drift. No other
engine re-derives the gate without the controlExempt term on an exempt path.

## Tests
```
$ npx vitest run claude.controlExempt
 Test Files  1 passed (1)
 Tests  3 passed (3)
```
Full gate + exit code in closure.md.
