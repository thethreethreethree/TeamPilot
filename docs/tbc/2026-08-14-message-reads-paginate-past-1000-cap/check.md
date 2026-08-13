# CHECK — page the message reads past the 1000-row cap

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — unbounded message reads truncate long threads at 1000, dropping the NEWEST
file+line: `src/lib/data/chats.ts` (`fetchMessages`) + `src/lib/data/care.ts:297`
(`listCareMessagesForCustomer`). Each reads `.select().eq(...).order("created_at", ascending)` with no
limit/range → PostgREST caps at 1000 → the oldest 1000 shown, the newest hidden. A busy team channel looks
frozen in the past; the AI copilot/dissect reads stale, truncated history.
class: silent-truncation / correctness (the documented unbounded-.select-at-1000 class).
severity: high (team-chat: active channels appear frozen) / medium (C.A.R.E support threads).
read-path: fixed by routing both reads through `fetchAllPaged` (pages past the cap) with a deterministic
`.order("id")` tiebreaker; behavior-preserving (whole thread, no truncation).
sweep-command: `grep -n "fetchAllPaged\|\.order(\"id\"" src/lib/data/chats.ts src/lib/data/care.ts`
— confirms both message reads page and use a stable tiebreaker.

## Sweep note (on the record)
The two CONFIRMED message readers are fixed here. Lower-reach candidates from the same audit — `tasks.ts` per-
task message reads — share the class but a task rarely exceeds 1000 messages; flagged as a follow-up, not fixed
in this scoped change. The aggregation-count candidates (care.ts team-growth) are the distinct "KPI-agg" item,
tracked separately.

## Tests
```
$ npx vitest run chats.pagination chats.errorState care/conversations/[id]/messages/errorState
 Test Files  3 passed (3)   ·   Tests  8 passed (8)
```
The multi-page detection test (returns 1005, newest present) + the retained throw-on-error tests lock the fix.
Full gate result in closure.md.
