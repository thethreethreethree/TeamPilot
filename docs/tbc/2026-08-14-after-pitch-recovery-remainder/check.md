# CHECK — After-Pitch recovery remainder (⑥ + ⑧)

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — a recovered session shows a STALE blank read when the client's post-recovery refresh is lost (finding ⑥)
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` `autoRecover()` (the `canonical` branch was
a no-op).
class: workflow-continuity / error-dressed-as-no-data (a recovered two-sided transcript exists in the DB while
the UI shows the old blank forever).
severity: medium (narrow window — the client generate() must be lost — but permanent once it happens).
sweep-command: `grep -n "canonical" src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` — the client now
regenerates on `canonical` (was ignored).
read-path: fixed — a `canonical` reload regenerates the After-Pitch from the now-two-sided transcript, once.

### F2 — a genuine single-voice decline degrades into a false-promise re-transcribe loop on reload (finding ⑧)
file+line: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts` (decline returned no persisted reason; the
`already-attempted` reload lost it).
class: recovery-idempotency / honesty (a definitive one-voice outcome was reported as a generic
already-attempted, so the client offered a card that re-charges STT and dead-ends at /label-transcript).
severity: medium (re-charges STT + strands the rep on a genuinely unrecoverable call).
sweep-command: `grep -n "coach.auto_recover_declined\|still-one-sided" src/app/api/coach/sales-session/[id]/auto-recover/route.ts`
— the decline is persisted and re-reported on reload.
read-path: fixed — a single-cluster decline is recorded; a reload returns `still-one-sided` (no STT, no card).

## Class sweep (A26)
The customer-missing recovery flow had FOUR gaps: first-visit miss (②) + transient marker burn (⑦) — closed in
the prior build — and stale-reload (⑥) + single-voice loop (⑧), closed here. With all four closed, the flow now:
engages on first view, retries on a transient failure, heals a lost-client refresh, and stays an honest terminal
for a genuine one-voice call.

## Tests
```
$ npx vitest run auto-recover
 Test Files  1 passed (1)
 Tests  14 passed (14)
```
Locks: single-cluster persists a decline; a reload with a prior decline returns still-one-sided (no STT);
ambiguous does not persist. Full gate + exit code in closure.md.
