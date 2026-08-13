# CHECK — recovery overwrite fix

## Verification run (A38)
Canonical command: `npm run check`.

## Findings

### F1 — the blank-read recovery stopgap (1728ee57) was BROKEN — the save always 409'd
file+line: `src/app/api/coach/sales-session/[id]/label-transcript/route.ts` (the pre-fix
`if (existing.length > 0) return 409`). The `BlankReadRecovery` affordance renders only for one-sided sessions
(segments present, blank read), but those have segments → the re-transcribe save 409'd → nothing recovered. A
misleading live feature.
class: nonfunctional-affordance (a UI path that cannot complete its action).
severity: high (shipped live, described as working)
read-path: fixed by keying the guard on agent turns — 409 only when the existing transcript is canonical (has an
agent segment); a 0-agent-turns transcript is deleted + replaced by the re-diarized one.
remediation: see remediate.md F1.
sweep-command: `grep -nE "speaker === \"agent\"|deleteSessionTranscriptSegments|alreadyHasTranscript" src/app/api/coach/sales-session/\[id\]/label-transcript/route.ts`
— confirms the 409 keys on agent turns and the delete is gated below it.

## Tests
```
$ npx vitest run "src/app/api/coach/sales-session/[id]/label-transcript/__tests__/route.test.ts"
 Test Files  1 passed (1)   ·   Tests  10 passed (10)
```
Both branches locked: canonical (has-agent) existing → 409 + no delete; broken (0-agent) existing → delete + save.

## Full gate
```
PENDING — pasted in closure after the run
```
