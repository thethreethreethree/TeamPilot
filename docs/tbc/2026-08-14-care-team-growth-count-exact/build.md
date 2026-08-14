# BUILD — care team/agent growth counts → exact head count

### fetchTeamGrowth — pure counts via head:true
read-path: `src/lib/data/care.ts` `fetchTeamGrowth` reads growth metrics for a company.
write-path: none (read). agents / resolutions / claimedConvs / awaitingConvs / agentReplies now use
`.select("id", { count:"exact", head:true })` and read `.count` — exact server-side counts, no 1000 cap. The
`bounded` honesty flag is narrowed to the remaining VALUE reads (durability / edits / coach_counts), which still
fetch rows because they need the values; its warning now names them as the follow-up.

### fetchAgentGrowth — pure counts via head:true
read-path: `src/lib/data/care.ts` `fetchAgentGrowth` reads the per-agent variant.
write-path: none. resolutions / claimedConvs / awaitingConvs / agentReplies converted the same way; consumption
reads `.count`. Value reads (durability / edits / coach_counts) unchanged.

## Test coverage
`teamGrowth.counts.test.ts` (NEW): mocks the supabase reads so a head:true query returns `{count}` (null data)
and a value read returns `{data: rows}`; asserts the snapshot's agentCount/resolutions/presence counts equal the
mocked counts (a reverted `.data.length` reads null → 0 and fails), and that the value-derived fields
(durability/copilot/coach) still come from the rows — proving the two read paths coexist.

## Out of scope (noted follow-up)
The VALUE reads (durability outcomes, copilot edit magnitudes, coach_counts sums) still cap at 1000 because they
need the row values, not a count. Their fix is `fetchAllPaged` or a server-side aggregate/RPC — flagged, not
done here (founder scoped this to the pure counts).
