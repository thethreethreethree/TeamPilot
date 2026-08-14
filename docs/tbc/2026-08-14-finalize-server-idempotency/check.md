# CHECK — /finalize server-side idempotency

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — /finalize re-runs all five LLM engines with no server idempotency (repeatable double-charge)
file+line: `src/app/api/coach/sales-session/[id]/finalize/route.ts` (`generateSessionArtifacts` called
unconditionally; only the client `finalizedRef` guarded it).
class: cost / server-idempotency (a paid multi-engine generation reachable more than once per user action, guarded
only client-side).
severity: medium (5× LLM generations per extra POST; reachability lower than retranscribe since the live
transcript is gone after a reload, but a 2nd tab / retry / future caller re-charges).
sweep-command: `grep -n "coach.dissect_generated" src/app/api/coach/sales-session/[id]/finalize/route.ts` — the
route now reads the marker before generating and skips on a repeat.
read-path: fixed — a repeat finalize with the dissect marker present returns `alreadyGenerated:true` without
re-charging.

## Class sweep (A26)
The "paid engine, only a client latch" class has two instances: /finalize (this fix) and /retranscribe. They need
DIFFERENT mechanisms — finalize reuses the existing dissect marker (a generation is once-per-session); retranscribe
is re-runnable by design with an ephemeral result, so its de-dup needs new persisted state (a migration). The
tractable instance is fixed here; retranscribe is flagged for a dedicated build (build.md out-of-scope).
Properly-guarded siblings confirmed: /auto-recover (atomic marker), /label-transcript (409 on canonical), the
dissect backfill (marker + backoff) — so this closes the last unguarded generation on the finalize path.

## Tests
```
$ npx vitest run finalize
 Test Files  3 passed (3)
 Tests  16 passed (16)
```
The idempotency case asserts the five engines are skipped when the dissect marker exists; the happy path asserts
they run on the first finalize. Full gate + exit code in closure.md.
