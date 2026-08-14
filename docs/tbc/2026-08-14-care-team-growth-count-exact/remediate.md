# REMEDIATE — care team/agent growth counts → exact head count

## F1 — pure counts via server-side exact head count
Remediation: in BOTH `fetchTeamGrowth` and `fetchAgentGrowth`, the pure COUNTS (agents, resolutions, claimed +
awaiting conversations, agent replies) now use `.select("id", { count:"exact", head:true })` and read `.count`.
This returns the exact server-side count with no rows transferred and no 1000-row cap, so an active team/agent's
growth metrics no longer silently under-report past 1000/window (§3.4 — no guessed-low number). The
`count:"exact", head:true` pattern is the one already used at care.ts:224/646/2902, so it's a known-good shape.
The §3.4 error-combine (throw → route 500 → honest error state) is unchanged (the head reads still expose
`.error`), and the value-derived rates/sums are byte-identical (their row reads are untouched).
gate: `teamGrowth.counts.test.ts` — the snapshot's counts equal the mocked head `.count` (a reverted
`.data.length` reads null → 0 and fails), while durability/copilot/coach fields still come from the value rows.
class: silent-truncation / correctness. severity: medium. Fixed.

## Scope / follow-up
The VALUE reads (durability outcomes, edit magnitudes, coach_counts sums) still fetch rows (they need the
values) and still cap at 1000 — a documented follow-up (fetchAllPaged / server-side aggregate). fetchTeamGrowth's
`bounded` honesty flag is narrowed to those value reads so it still warns if THEY cap. Founder scoped this fix to
the pure counts.
