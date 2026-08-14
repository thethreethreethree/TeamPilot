# CHECK — /retranscribe diarization cache

## Verification run (A38)
Canonical command: `npm run check` (+ `npm run db:apply` for the migration). Output + exit codes in closure.md.

## Findings

### F1 — /retranscribe re-charges a full STT diarization with no server idempotency (repeatable double-charge)
file+line: `src/app/api/coach/sales-session/[id]/retranscribe/route.ts` (STT ran on every POST; only client refs
in `SessionRecordingUpload.tsx` guarded it).
class: cost / server-idempotency (a paid full-recording STT reachable on every reload / 2nd tab / on-mount
auto-fire — the most cost-dense repeatable charge in the product).
severity: high (a full-recording diarization re-charge per extra fire; the auto-fire re-fires on EVERY reload).
sweep-command: `grep -n "coaching_retranscribe_cache" src/app/api/coach/sales-session/[id]/retranscribe/route.ts`
— the route now reads the cache before STT and returns it on a pointer match.
read-path: fixed — a repeat for the same recording returns the cached diarization with no STT.

## Class sweep (A26)
The "paid generation guarded only by a client latch" class had two instances: /finalize (finding ⑨, closed
earlier with the dissect marker) and /retranscribe (this fix, closed with the diarization cache). Both paid
paths are now server-idempotent. The properly-guarded siblings (/auto-recover atomic marker, /label-transcript
409, dissect backfill marker) remain the reference pattern.

## RLS (the new table)
`coaching_retranscribe_cache` has RLS ENABLED with NO policies (service-role-only, the care_visitor_presence
pattern); the 4 ops are allowlisted in `scripts/rls-audit.mjs`, so `npm run rls:audit` passes. A member cannot
read the cache (call content) or write a forged diarization directly.

## Tests
```
$ npx vitest run retranscribe
 Test Files  1 passed (1)
 Tests  12 passed (12)
```
Locks: cache hit skips STT; stale pointer / force re-diarizes; a miss caches keyed on the current recording.
Full gate + db:apply in closure.md.
