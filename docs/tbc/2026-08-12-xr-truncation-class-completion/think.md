---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T10:45:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — close the unbounded-.select() truncation class (founder-authorized "fix them all")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (founder-authorized, §1.2 record-checked FIRST this time)
The unbounded-`.select()` 1000-row truncation class was swept across the app this session: the HIGH instance
(KPI Reliance Reduction) was fixed with founder authorization (build xo). Three lower-severity instances were
SURFACED (dashboard, CARE analytics, list-badge) and I flagged them as gated on the founder's keep/revert
decision. The founder then explicitly chose **"Fix them all (keep everything)"** (AskUserQuestion 2026-08-12).
So — unlike the earlier CARE-readout misstep — this fix follows an EXPLICIT founder decision, not an inference.

## 3. The instances (all confirmed by reading the code earlier in the sweep)
- **`coach/sales-session/dashboard/route.ts`** — a rep's sessions read unbounded → `sessionsTotal` + pipeline
  counts + cue-total capped at 1000 for a rep past 1000 lifetime sessions.
- **`care/agent/analytics/route.ts`** — support_conversations read `.limit(5000)` (no disclosure) → resolution
  rate + first-response-time median/buckets wrong for a team past 5000 window-conversations.
- **`coach/sales-session/list/route.ts`** — the badge-events + signal-events reads `.in("subject", subjects)`
  unbounded → with heavy per-session regeneration, badges/signals could truncate past 1000 rows.

## 4. The fix (mirror the established pattern — A16)
Each read now uses `fetchAllPaged` (the same helper the KPI + CARE-readout fixes use) with a stable order:
- dashboard + CARE analytics + list-badge → `.order("id")` (uuid PK).
- list SIGNALS → `.order("created_at", desc).order("id", desc)` — the "latest per (session,kind) wins" rule
  needs the created_at-desc order preserved across pages; id-desc is the stable tiebreaker so range paging is
  deterministic (ordering by id alone would BREAK the latest-wins semantics — the one non-mechanical case).
Error handling: fetchAllPaged throws → `.catch(() => null)`; the dashboard fails LOUD (§3.4 — a failed read
must not read as zero activity; also genericized its previously raw-error 500, a CWE-209 bonus), the list-badge
sets `badgesAvailable=false` (its existing honest-unavailable state), CARE analytics preserves its prior swallow.

## 5. Residual acknowledged
The `.in(session_id/subject, ids)` reads carry a >1000-id list once the driving set exceeds 1000 (rep past 1000
sessions / >1000 subjects) — the same rarer concern flagged on the KPI fix; the real fix there is a server-side
aggregate RPC. The list is 300-capped so its subjects stay bounded; the dashboard cue-count is the exposed one.

## 6. Hypotheses (§1.5.2)
- **H1 — does paging change small-dataset results (the tests)?** No: a <1000-row set ends fetchAllPaged after
  one short page, identical to the single read. The dashboard + CARE-analytics tests are unchanged in intent
  (only their mocks now model `.order().range()`). CONFIRMED (9/9 route tests green).
- **H2 — does the list SIGNALS paging preserve "latest wins"?** Yes: created_at-desc is preserved across pages
  with id-desc as the stable tiebreaker, so the first-seen-per-session is still the latest. CONFIRMED by the
  order + the extractSessionSignals contract.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T10:45:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand each read before changing it.", "how_this_build_will_embody_it": "Section 3 names each instance from the code." },
  { "id": "§0.1", "read_at": "2026-08-12T10:45:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T10:46:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Record-check BEFORE fixing a gated class — the lesson from the CARE-readout misstep.", "how_this_build_will_embody_it": "This fix follows the founder's EXPLICIT 'fix them all' decision, not an inference (section 2)." },
  { "id": "§1.5.1", "read_at": "2026-08-12T10:46:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — fix every remaining instance of the class, consistently.", "how_this_build_will_embody_it": "All three surfaced instances fixed with the one established pattern." },
  { "id": "§1.5.2", "read_at": "2026-08-12T10:46:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive — the signals-order + >1000-id edges before shipping.", "how_this_build_will_embody_it": "H2 covers the latest-wins order; section 5 documents the >1000-id residual." },
  { "id": "§3.4", "read_at": "2026-08-12T10:46:50Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a failed read must not read as zero.", "how_this_build_will_embody_it": "Dashboard fails loud (+ generic 500, CWE-209); list-badge keeps its unavailable state." },
  { "id": "§6", "read_at": "2026-08-12T10:47:05Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — record-check + holistic before acting.", "how_this_build_will_embody_it": "Sections 2-5." },
  { "id": "A16", "read_at": "2026-08-12T10:45:45Z", "source_file": "ThinkerThinker.md", "line_range": "381-390", "why_it_governs": "Reuse the established fetchAllPaged pattern.", "how_this_build_will_embody_it": "Mirrors the KPI/CARE-readout fixes." },
  { "id": "A19", "read_at": "2026-08-12T10:45:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree.", "how_this_build_will_embody_it": "Read each route + fetchAllPaged in-tree before changing them." },
  { "id": "A22", "read_at": "2026-08-12T10:47:20Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-12T10:47:35Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson in a test.", "how_this_build_will_embody_it": "The dashboard + CARE-analytics route tests were updated to model the paged chain and still pin the counts." },
  { "id": "A38", "read_at": "2026-08-12T10:47:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check with exit codes." }
]
```
