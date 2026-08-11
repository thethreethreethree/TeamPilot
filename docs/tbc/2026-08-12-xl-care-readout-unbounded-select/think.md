---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T00:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — CARE analytics readouts silently truncate their message aggregation at 1000 rows (§3.5)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes unchanged.

## 2. Why (a RECORDED lead, not a fishing expedition)
Memory `project_audit_provenance_2026_08_02` lists "msg pagination" as an OPEN audit item, and
`reference_unbounded_select_silent_truncation_1000cap` records the class: a `.select()` with no `.limit`/
`.range` is silently capped at PostgREST `max_rows=1000`, so a derived count/classification over a high-growth
table is WRONG past the cap. The Coach KPI surface was fixed for this (fetchAllPaged); the CARE readouts were
not swept.

## 3. The finding (confirmed by reading the readouts)
Four CARE §3.5 "measure the method against the alternative" readouts aggregate messages/checks across MANY
conversations with an unbounded `.in("conversation_id", …).select(...)`:
- `fetchCoachRubricReadout` — agent messages → v6/v5/ungraded cohort classification.
- `fetchVoiceValueReadout` — customer messages → voiceUsed/voiceNotUsed cohort.
- (co-pilot readout) — agent messages → coPilotUsed/coPilotNotUsed cohort.
- (durability readout) — `support_durability_checks` → per-conversation held/reopened bucket.

On an active account the message/check rows across the window easily exceed 1000, so PostgREST returns only
the first 1000 and **every conversation whose rows fall past the cap is silently MISCLASSIFIED** (defaulted to
ungraded / voiceNotUsed / coPilotNotUsed / no-durability). That is measuring the wrong thing on exactly the
readouts that grade whether the method works — the §3.5 "grading your own homework" failure, in the silent-
truncation shape (§3.4 dishonest: a wrong number presented as real).

## 4. The fix
Page the full set with the established `fetchAllPaged` helper + a stable `id` order (both tables have a uuid
PK, so range pagination returns every row exactly once). fetchAllPaged THROWS on a read error, which also
upgrades the two readouts that previously swallowed the error into an empty result (§3.4 fail-loud).

## 5. Record check (§1.2) — is the truncation intentional?
No: these are analytics that classify EVERY conversation in the window; there is no design intent to sample
the first 1000 rows. The Coach KPI precedent (fetchAllPaged) is the established, in-codebase fix for exactly
this class — this applies it to the unswept CARE surface (A16/A26).

## 6. Hypothesis (§1.5.2)
- **H1 — does paging change the result for small datasets (the tests)?** → No: a short first page (<1000 rows)
  ends fetchAllPaged after one page, identical to the single unbounded read. The coach-rubric-readout test
  (4 conversations) is unchanged. Only high-volume accounts (>1000 rows) change — from WRONG to correct.
  CONFIRMED (309 care tests green).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T00:30:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — read WHY the readout is wrong (the 1000 cap) before changing it.", "how_this_build_will_embody_it": "Root cause read from the query + the max_rows cap; the fix targets that, not a symptom." },
  { "id": "§0.1", "read_at": "2026-08-12T00:30:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Governing-doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T00:31:00Z", "source_file": "CLAUDE.md", "line_range": "52-60", "why_it_governs": "Retrospective identification — this follows a RECORDED audit lead (the 1000-cap class + the open msg-pagination item), not a fresh guess.", "how_this_build_will_embody_it": "Section 2 cites the recorded class + open item that led here." },
  { "id": "§1.5.1", "read_at": "2026-08-12T00:31:15Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — sweep the whole class, not the one readout that surfaced it.", "how_this_build_will_embody_it": "Swept every cross-conversation .in() aggregation; fixed all four." },
  { "id": "§1.5.2", "read_at": "2026-08-12T00:31:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — THINK about where the cap bites, then grep the aggregations to confirm.", "how_this_build_will_embody_it": "Grepped `.in(conversation_id` across care.ts; classified each hit." },
  { "id": "§3.4", "read_at": "2026-08-12T00:31:45Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a truncated aggregate presented as the real number is a lie; a swallowed read error is worse.", "how_this_build_will_embody_it": "The paged read is complete AND fails loud on error (two readouts previously swallowed it into empty)." },
  { "id": "§3.5", "read_at": "2026-08-12T00:32:00Z", "source_file": "CLAUDE.md", "line_range": "294-330", "why_it_governs": "Measurement rules — the readout that grades the method must measure the real thing, not a 1000-row sample.", "how_this_build_will_embody_it": "The cohort classification now sees every conversation in the window." },
  { "id": "§6", "read_at": "2026-08-12T00:32:15Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The decision checklist forces record-check + holistic before acting.", "how_this_build_will_embody_it": "Section 5 checks the record; the class was swept to all four instances." },
  { "id": "A19", "read_at": "2026-08-12T00:30:45Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Read the four readouts + fetchAllPaged in-tree before changing them." },
  { "id": "A22", "read_at": "2026-08-12T00:32:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-12T00:32:45Z", "source_file": "ThinkerThinker.md", "line_range": "66-72", "why_it_governs": "A found bug is a class — sweep it to the codebase boundary.", "how_this_build_will_embody_it": "The single-readout lead became a sweep of all four cross-conversation aggregations." },
  { "id": "A30", "read_at": "2026-08-12T00:33:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class in a test where feasible; where not, name it.", "how_this_build_will_embody_it": "The coach-rubric test locks the paged path is behaviour-preserving; the general no-unbounded-select gate is named as a residual (A33 — a precise grep is hard without false positives on bounded reads)." },
  { "id": "A38", "read_at": "2026-08-12T00:33:15Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check runs with exit codes." }
]
```
