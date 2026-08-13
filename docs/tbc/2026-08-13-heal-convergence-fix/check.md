# CHECK — after-pitch heal convergence fix

## Verification run (A38)
Canonical command: `npm run check`.

## Findings

### F1 — narrative-heal re-fired forever on one-sided recordings (non-convergence)
file+line: `src/lib/coach/v5/afterPitchHeal.ts` (the `!existing.narrative.hasSignal` clause) interacting with
`src/lib/coach/v5/afterPitch.ts:160` (four-term composite), `salesMoments.ts:54` (MIN_SEGMENTS=1, any speaker),
`salesReview.ts:67` (EMPTY_REVIEW at 0 agent turns, deterministic), `salesScore.ts:182` (EMPTY at 0 agent turns).
class: non-converging-auto-heal (unbounded LLM spend + a permanently-blank read the heal falsely promises to fix).
severity: high
read-path: fixed by gating the narrative clause on `existing.scores.length > 0` — an exact proxy for "agent
turns present" (scores empty ⟺ agentSegments < MIN), i.e. the RECOVERABLE case only.
remediation: see remediate.md F1.
sweep-command: `grep -nE "scores.length|narrative.hasSignal" src/lib/coach/v5/afterPitchHeal.ts`
— confirms the narrative-heal clause requires scores present.

## Tests
```
$ npx vitest run src/lib/coach/v5/__tests__/afterPitchHeal.test.ts
 Test Files  1 passed (1)   ·   Tests  5 passed (5)
```
Detection test: the one-sided-recording case (blank narrative + composite true + scores EMPTY) now asserts
`afterPitchNeedsHeal === false`, and asserts the pre-fix narrative-only trigger WOULD have been true — so a
revert to the looping predicate fails this file. The starved case (scores present) still heals.

## Accepted residual (not fixed — reasoned)
A call WITH agent turns whose review yields growth but zero strengths (tone-law → blank) OR persistent F3
corpus starvation re-heals per visit. Rare, semi-desirable (retry toward a valid read), bounded per-visit,
tied to the founder-gated corpus-trim. A durable once-per-session marker would close it but adds a
browser-API-throws surface for a rare case — deferred.

## Full gate
```
PENDING — pasted in closure after the run
```
