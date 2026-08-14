# CHECK — care team/agent growth counts → exact head count

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — team/agent growth PURE COUNTS under-report past 1000/window
file+line: `src/lib/data/care.ts` `fetchTeamGrowth` (~3298) + `fetchAgentGrowth` (~3710). Counts were computed
by SELECTing rows then `.length`; PostgREST caps a `.select()` at ~1000, so past 1000 rows in the 30-day window
the counts silently CAP → under-report growth (§3.4 — a guessed-low number). `agentReplies` is the reachable one.
class: silent-truncation / correctness (unbounded .select-at-1000 → wrong derived metric).
severity: medium (silent wrong metric; reachable only past 1000/window).
read-path: fixed — the pure counts (agents, resolutions, claimed/awaiting convs, agent replies) in BOTH functions
now use `.select("id", {count:"exact", head:true})` and read `.count` (exact server-side count, no cap).
sweep-command: `grep -n "count: \"exact\", head: true\|\.count ?? 0" src/lib/data/care.ts`
— confirms both functions' pure counts use head-count + read .count.

## Scope note (on the record)
The VALUE reads (durability outcomes, copilot edit magnitudes, coach_counts sums) genuinely need the row values,
not a count, so they still fetch rows and still cap at 1000 — a documented follow-up (fetchAllPaged / a
server-side aggregate). fetchTeamGrowth's `bounded` honesty flag is narrowed to just those value reads and its
warning names them. This matches the founder-scoped decision (the pure counts).

## Tests
```
$ npx vitest run teamGrowth.counts
 Test Files  1 passed (1)   ·   Tests  1 passed (1)
```
The detection test asserts the snapshot's counts come from `.count` (head:true) and would be 0 (fail) on a
reverted `.data.length`, while the value-derived fields still come from rows. Full gate in closure.md.
