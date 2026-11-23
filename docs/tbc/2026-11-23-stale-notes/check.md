# CHECK - Say when the AI notes are older than the corrections

## Commands

```
npx vitest run transcriptEdits.test.ts SessionTranscript.edit.render transcript-edit route → 21 passed (newer correction → true; older → false; unknown build time → true; fresh notes → no button; older notes → sentence + button)
npm run check (first) → ✗ invariant:audit "a sales-session handler serves sales coaching without asking isSalesCall" (the GET now reads the notes' events) → GET and PUT branch on isSalesCall → Violations: 0; route test: a meeting's refresh is refused (409)
npm run check (second) → ✗ sessionArtifactReadGate: "reads a sales_session:-subject row … without calling getSession()" — the GET is gated by access(), which calls getSession() and 404s, but the guard only looked inside the handler body
guard taught same-file gating helpers (gatingHelpers/handlerGated, both branches tested) → 7 passed · mutation: getSession removed from access() → 1 failed; restored → 7 passed
```

## Findings

### F1 - a meeting or huddle would have been offered a refresh of sales AI notes it doesn't have (and the PUT accepted)
class: a sales-only feature reachable from a non-sales session (invariant 'isSalesCall').
sweep: transcript-edit GET and PUT; the POST (correcting a line) applies to any call and stays.
severity: low (generateSessionArtifacts returns early for non-sales, but the button and audit row would be wrong)

### F2 - the IDOR read-gate guard couldn't see a gate done in a same-file helper
class: a structural guard matching text in one function, blind to the same check one call away.
sweep: the guard now accepts a same-file function that calls getSession(); mutation-checked (removing the call fails it).
severity: low (no leak: the gate existed; the guard was too narrow)


## Final

```
npm run check → exit 0 · Test Files 900 passed | 1 skipped · Tests 6659 passed | 15 skipped
```
