---
started_at: 2026-09-03T13:05:00+08:00
---

# THINK — my-points summary truncation fix (gamification audit follow-on)

## Why (an outside-view audit of the just-built data path found a latent wrong number)
Immediately after Phase 6, I ran the §1.5.2 proactive audit over the four gamification routes from the security +
correctness lens. Scoping was solid (leaderboard delegates tenant-scope to the security-definer RPC; my-points is
owner-pinned; notifications mark-read is pinned to recipient_id). But my-points computed the rep's summary
(total / avg / sessions) from an ascending `.limit(200)` fetch.

## Understanding (why the limit is a bug, not a bound)
Two defects stack in that one line:
1. Past 200 banked sessions, total/avg are computed over only 200 rows — diverging from the LEADERBOARD's
   authoritative DB SUM for the same rep. Same concept, two surfaces, two different numbers (a layer-3 composition
   break).
2. Because the fetch is `order(created_at ASC).limit(200)`, the 200 kept are the OLDEST, not the recent — so a
   veteran rep's "Your progress" trend would show ancient sessions and a stale total.
This is the silent-truncation class (reference: fetchAllPaged exists precisely for it) — a plausible wrong number
that worsens exactly as a rep succeeds and accumulates data (the §3.4 honesty-thesis failure: a wrong number is
worse than a visible error).

## The build
- `src/app/api/coach/gamification/my-points/route.ts` — page the owner-scoped read with `fetchAllPagedResult`,
  compute total/avg/sessions over the FULL history (matching the board), and bound the per-session `rows` returned
  for the trend to the most-recent 200 (payload size, still ascending for left→right).
- Test: +1 proving the summary reflects all 205 while the trend caps at the recent 200 (session s5..s204).

## Verification (A38)
`npm run typecheck` clean; `my-points/__tests__/route.test.ts` → 4 passed (was 3). Dormant in the pilot (top rep
~57 sessions) so no live-data change is observable yet; the fix is proven by the unit test, not asserted.

## Out of scope
The leaderboard/notifications/calibration routes were audited and found correct (scoping delegated correctly); no
change needed there. A server-side aggregate RPC (do the SUM in SQL, fetch nothing) is the fully-consolidated form
if a rep's history ever gets very large — a future refinement, not needed at pilot scale.

## Session-read manifest (A22 — read_at >= started_at 13:05; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T13:09:00+08:00",
    "why_it_governs": "Understanding precedes solving — I diagnosed WHY the limit is wrong (divergence + oldest-kept) from the record before touching it, not patched the symptom.",
    "how_this_build_will_embody_it": "The fix addresses the root (compute over the full set) rather than bumping the limit." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T13:09:10+08:00",
    "why_it_governs": "The methodology defining understanding must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md is in context; the cited axioms were re-opened this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T13:09:12+08:00",
    "why_it_governs": "Retrospective identification — the fix reuses the existing fetchAllPaged pattern the codebase already paid for, not a new one.",
    "how_this_build_will_embody_it": "Uses fetchAllPagedResult, the established truncation-class remedy." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T13:09:14+08:00",
    "why_it_governs": "Holistic — the bug was a CROSS-surface inconsistency (board vs progress), found by tracing the whole feature, not one route.",
    "how_this_build_will_embody_it": "The summary is now computed the same way the board sums, so the two surfaces agree." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T13:09:20+08:00",
    "why_it_governs": "Layer-2 effectivity — the number must be RIGHT, proven, not merely rendered.",
    "how_this_build_will_embody_it": "A test proves total/sessions reflect all 205 while the trend caps at 200." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-03T13:09:30+08:00",
    "why_it_governs": "Proactive THINK + search — this fix IS the output of that rule applied to code I just shipped.",
    "how_this_build_will_embody_it": "Audited all four routes, surfaced the one real finding, fixed it with a test." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-198", "read_at": "2026-09-03T13:09:34+08:00",
    "why_it_governs": "External-config completeness — carried from the parent gamification build (migration 0244 still pending db:apply).",
    "how_this_build_will_embody_it": "This route change needs no migration; the pending 0244 remains flagged in the Phase 6 residual." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-235", "read_at": "2026-09-03T13:09:36+08:00",
    "why_it_governs": "User-specified experience is layer-2 — n/a here (no specified surface change), noted for completeness of the cumulative citation set.",
    "how_this_build_will_embody_it": "No design change; the summary just becomes correct." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-270", "read_at": "2026-09-03T13:09:38+08:00",
    "why_it_governs": "Ground-up audit — this finding came from walking the feature's data path from the read up.",
    "how_this_build_will_embody_it": "The read layer (the truncated fetch) was the flagged layer; fixed there." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T13:09:42+08:00",
    "why_it_governs": "Single-source — the board's SUM is the authority; the progress summary must not re-derive a different total from a truncated copy.",
    "how_this_build_will_embody_it": "Both now sum the full owner-scoped set, so no drift between the two surfaces." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-09-03T13:09:44+08:00",
    "why_it_governs": "Honesty — a plausible-but-wrong total is the exact failure this thesis forbids.",
    "how_this_build_will_embody_it": "The summary is now the true total; the paging helper fails HONESTLY (throws) rather than returning a partial set." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-392", "read_at": "2026-09-03T13:09:46+08:00",
    "why_it_governs": "Measurement rules — a rep's shown points must be defensible, not an artifact of a page size.",
    "how_this_build_will_embody_it": "total/avg/sessions are computed over the full history." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-430", "read_at": "2026-09-03T13:09:48+08:00",
    "why_it_governs": "Verify before claiming done.",
    "how_this_build_will_embody_it": "typecheck + the +1 window test run before commit." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T13:09:50+08:00",
    "why_it_governs": "Quick-decision checklist (understand the root, reuse the helper, verify).",
    "how_this_build_will_embody_it": "Root-cause fix via the existing helper, test-verified." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-450", "read_at": "2026-09-03T13:08:00+08:00",
    "why_it_governs": "Privacy — the audit confirmed my-points stays owner-scoped (agent_id = caller); no leak introduced.",
    "how_this_build_will_embody_it": "The paged read keeps the owner-scoping eq; only the caller's own rows are summed." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-03T13:08:10+08:00",
    "why_it_governs": "Methodology in the tree, read in session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session before citing them." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-640", "read_at": "2026-09-03T13:08:20+08:00",
    "why_it_governs": "Session-read manifest before closure.",
    "how_this_build_will_embody_it": "This manifest pairs each cited asset with an in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-03T13:08:30+08:00",
    "why_it_governs": "Gate the lesson — the truncation fix is pinned by a test that fails without it.",
    "how_this_build_will_embody_it": "The +1 test exercises the >200 case that the old limit got wrong." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-03T13:08:40+08:00",
    "why_it_governs": "'Verified' names the command.",
    "how_this_build_will_embody_it": "check.md names typecheck + the exact test file + its pass count." }
]
```
