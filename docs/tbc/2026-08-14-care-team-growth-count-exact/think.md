---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T04:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — care team/agent growth counts under-report past 1000/window

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (record-check §1.2 — a confirmed MEDIUM finding from this session's audit)
`fetchTeamGrowth` (care.ts:3292) and `fetchAgentGrowth` (care.ts:3704) compute growth metrics by SELECTing rows
then taking `.length`. PostgREST silently caps a `.select()` at ~1000, so once a company/agent crosses 1000
rows in the 30-day window the counts CAP at 1000 → silently UNDER-report growth (a §3.4 honesty violation — a
guessed-low number). `agentReplies` is the reachable one (an active support team easily sends >1000 agent
messages/window). Founder chose the behavior-preserving count fix (the same `count:"exact", head:true` pattern
already used at care.ts:224/646/2902).

## 3. The fix
Convert the PURE COUNTS (agents, resolutions, claimed/awaiting conversations, agent replies) in both functions
to `.select("id", { count:"exact", head:true })` and read `.count` — an exact server-side count with no cap and
no rows transferred. The VALUE reads (durability outcomes, edit magnitudes, coach_counts sums) genuinely need
the row VALUES, so they stay row reads (and still cap at 1000) — a documented follow-up (fetchAllPaged / a
server-side aggregate). fetchTeamGrowth's `bounded` honesty flag is narrowed to just those value reads.

## 4. Interconnections traced (§1.5)
- Both functions share the same read/consume shape; both are fixed (fetchAgentGrowth has no `bounded` field, so
  only its counts + consumption change).
- The head:true reads still expose `.error`, so the existing §3.4 error-combine (throw → route 500 → honest
  error state) is unchanged.
- `agentReplies` in fetchTeamGrowth counts through a `support_conversations!inner(company_id)` filter — the
  embedded-resource count is the same PostgREST feature used elsewhere; head:true returns the count of matching
  parent rows.
- The value reads (durability/edits/coach) are untouched, so all rate/sum derivations below are byte-identical.

## 5. Hypothesis (§1.5.2)
- **H1 — do the snapshot counts now come from `.count` (uncapped) rather than `.data.length` (capped at 1000)?**
  Yes. CONFIRMED by teamGrowth.counts.test.ts: with head:true reads mocked to return a `count` and null data,
  the snapshot's agentCount/resolutions/presence counts equal the mocked counts — a reverted `.data.length`
  would read null → 0 and fail.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T04:00:05Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the under-count from the record before fixing — read both functions' reads + consumption.", "how_this_build_will_embody_it": "Confirmed the .select().length cap in fetchTeamGrowth + fetchAgentGrowth before converting." },
  { "id": "§0.1", "read_at": "2026-08-14T04:00:08Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-14T04:00:11Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Record-check: the under-count re-verified in the current code (both functions).", "how_this_build_will_embody_it": "Read the reads + the return consumption before editing; found the second function (fetchAgentGrowth)." },
  { "id": "§1.5", "read_at": "2026-08-14T04:00:14Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the change touches two functions, the error-combine, and the value reads it must NOT disturb.", "how_this_build_will_embody_it": "Section 4 traces both functions, the error-combine, the untouched value derivations." },
  { "id": "§1.5.1", "read_at": "2026-08-14T04:00:16Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-1 build-structure — a count query is the right shape for a count; a row-read for a count is the defect.", "how_this_build_will_embody_it": "Counts use head:true; value reads keep row reads (they need values)." },
  { "id": "§1.5.2", "read_at": "2026-08-14T04:00:18Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive THINK-then-verify: hypothesize that the snapshot counts now come from the uncapped head .count rather than the capped .data.length, then confirm it with a detection test instead of assuming it.", "how_this_build_will_embody_it": "H1 stated + confirmed by teamGrowth.counts.test.ts (counts equal the mocked head count; a reverted .data.length reads null → 0 and fails)." },
  { "id": "§3.4", "read_at": "2026-08-14T04:00:21Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty — a silently-capped metric is a guessed-low number; the error-combine must stay honest.", "how_this_build_will_embody_it": "Exact counts; the narrowed `bounded` flag still warns for the remaining value-read caps; the error throw is preserved." },
  { "id": "§6", "read_at": "2026-08-14T04:00:24Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (two functions, the shared presence block, the error-combine).", "how_this_build_will_embody_it": "Both functions converted; the shared presence block updated once both were head:true." },
  { "id": "A19", "read_at": "2026-08-14T04:00:27Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read both functions fully; found + fixed the second (fetchAgentGrowth) before touching the shared consumer." },
  { "id": "A22", "read_at": "2026-08-14T04:00:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-14T04:00:33Z", "source_file": "ThinkerThinker.md", "line_range": "640-660", "why_it_governs": "Scope — convert only the pure COUNTS; leave the value reads (a separate approach) as a noted follow-up.", "how_this_build_will_embody_it": "Only the 9 count reads across the two functions changed; value reads untouched." },
  { "id": "A30", "read_at": "2026-08-14T04:00:36Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the property with a test.", "how_this_build_will_embody_it": "teamGrowth.counts.test.ts locks 'counts come from .count (head:true), not .data.length'." },
  { "id": "A38", "read_at": "2026-08-14T04:00:39Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "closure.md pastes the full-gate output + exit code." }
]
```
