---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T13:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 2
---

# THINK — fix the KPI compute-cron agent-enumeration truncation

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (a real, if dormant, truncation bug — the last surfaced instance I can fix without a founder decision)
`compute-cron` enumerates the agents to snapshot by reading `coaching_sessions.select("company_id, agent_id")`
with a fixed 5000-row cap. PostgREST caps that at 1000 REGARDLESS, and the read is ordered by agent_id — so a
company past 1000 sessions only ever surfaces the alphabetically-first agents, and agents whose sessions sort late
get NO KPI snapshot. This bites even with far fewer than BATCH_AGENTS (100) agents: 100 agents × 11 sessions =
1100 rows pushes the 100th agent past the 1000-row cutoff, so it is silently skipped. That is the same
truncation class swept this session — the last surfaced instance, and (unlike the finance register UI / CARE
KEEP-REVERT) an unambiguous BUG with a clear fix, so it is buildable without a founder decision. The cron is
DORMANT (no CRON_SECRET), so shipping the fix has zero live-user risk.

## 3. The fix (mirror the pattern the SAME file already uses)
`compute-cron` already pages its per-agent session load via `fetchAllPaged`. The agent-enumeration read was the
one inconsistent unpaged read. Page it the same way — `fetchAllPaged(...).order("id").range(...)` (stable uuid
key) to enumerate EVERY distinct agent — then `[...agents].sort().slice(0, BATCH_AGENTS)` to take the first
BATCH_AGENTS by a deterministic agent_id order (same batch semantics as before, minus the truncation). On a read
error, fetchAllPaged throws → caught → the route returns its existing `{ computed: 0, note }` shape.

Removing the `.limit(5000)` also makes compute-cron's FALSE_LIMIT_ALLOWLIST entry STALE — and the self-cleaning
check I shipped in build xu FLAGS exactly that, so I removed the entry in the same commit. The guard proved itself
in practice: it forced the allowlist back in sync.

## 4. Boundary (§1.5.1 / A26 — what this does NOT fix)
BATCH_AGENTS=100 with no cross-run rotation means agents beyond the alphabetically-first 100 still never get a
snapshot. That is a separate DESIGN decision (rotation / cursor), NOT a truncation bug, and it stays founder-gated
(flagged in the queue). This build fixes only the enumeration truncation — it makes the first 100 CORRECT and
COMPLETE, which they were not.

## 5. Hypotheses (§1.5.2)
- **H1 — does paging the enumeration change small-data behaviour?** No: a <1000-session company ends fetchAllPaged
  after one short page, identical to the old single read; the distinct-agent Map + sort + slice is unchanged in
  intent. CONFIRMED — the route test (enumerate → load → 12 inserts for the agent) passes.
- **H2 — is the batch still deterministic?** Yes: `[...keys()].sort().slice(0, 100)` takes the first 100 agent_ids
  by a stable lexicographic sort, matching the old `.order("agent_id")` intent — but now over the FULL agent set,
  not a 1000-row-truncated one. CONFIRMED by reading the code + the passing test.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T13:30:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the cron's full enumerate→load→compute flow before changing the enumeration, so the fix keeps the batch semantics the later stages assume.", "how_this_build_will_embody_it": "Section 3 pages the enumeration to match the file's existing loadAllSess paging; section 5 confirms the batch is unchanged in intent." },
  { "id": "§0.1", "read_at": "2026-08-12T13:30:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T13:30:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective — this instance was surfaced + recorded earlier this session; the fix draws on that record, not a fresh theory.", "how_this_build_will_embody_it": "Section 2 cites the surfaced-finding history; the fix mirrors the established fetchAllPaged pattern." },
  { "id": "§1.5.1", "read_at": "2026-08-12T13:31:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic + honest boundary — the enumeration fix ripples into the FALSE_LIMIT allowlist (must re-sync) and must NOT be mistaken for fixing the separate no-rotation design gap.", "how_this_build_will_embody_it": "Section 3 re-syncs the allowlist; section 4 draws the rotation boundary as still founder-gated." },
  { "id": "§1.5.2", "read_at": "2026-08-12T13:31:10Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Build only what there is evidence for — a real (if dormant) truncation bug — and flag the adjacent design gap rather than silently redesign.", "how_this_build_will_embody_it": "Fixes the truncation; the rotation design stays a flagged founder decision." },
  { "id": "§6", "read_at": "2026-08-12T13:31:20Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The checklist forces me to confirm the ripple (allowlist re-sync) and that the batch semantics are preserved before calling the fix done.", "how_this_build_will_embody_it": "Sections 3-5 + the passing route test." },
  { "id": "A16", "read_at": "2026-08-12T13:30:50Z", "source_file": "ThinkerThinker.md", "line_range": "381-390", "why_it_governs": "Reuse the established fetchAllPaged pattern rather than invent a new read shape.", "how_this_build_will_embody_it": "Mirrors the file's own loadAllSess paging." },
  { "id": "A19", "read_at": "2026-08-12T13:30:55Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the surface in-tree before changing it — the cron's flow and the FALSE_LIMIT allowlist both had to be read to fix one without breaking the other.", "how_this_build_will_embody_it": "Read compute-cron end-to-end + the invariant-audit allowlist in-tree before editing either." },
  { "id": "A22", "read_at": "2026-08-12T13:31:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads." },
  { "id": "A30", "read_at": "2026-08-12T13:31:40Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the change in a test — the cron's route test had to be re-keyed to the paged enumeration and still pin the enumerate→compute path.", "how_this_build_will_embody_it": "The mock now discriminates the enumeration read by its select columns; 7/7 tests pass; the >1000 boundary is covered by paginate.test.ts." },
  { "id": "A38", "read_at": "2026-08-12T13:31:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the vitest + full-gate output with exit codes." }
]
```
