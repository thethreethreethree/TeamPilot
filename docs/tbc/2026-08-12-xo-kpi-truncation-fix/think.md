---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T07:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 2
---

# THINK — KPI Reliance-Reduction headline metric truncates at 1000 rows (founder-authorized fix)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (a founder-authorized fix of a surfaced audit finding)
A ground-up truncation-class sweep of the Sales-Coach + KPI surface (this session) found that `kpi/me` and
`kpi/team` page their SESSIONS read with `fetchAllPaged` but then read the dependent usage-growth tables —
`after_pitch_summaries`, `coaching_cues`, `coaching_cue_outcomes`, `coaching_transcript_segments` — with a
bare unbounded `.select().in(...)`, silently capped by PostgREST at 1000 rows. `transcript_segments` is the
highest-volume table (~dozens of rows per session), so the cap is crossed at ~25-30 coached sessions — most
active reps — after which `coachedSessions` silently loses sessions and the RELIANCE REDUCTION headline metric
(§3.5) + `cueAcceptanceRate` are computed over the wrong set, in BOTH the rep and manager views. Surfaced to
the founder (queue, HIGH); the founder chose **"Fix it now"** (AskUserQuestion, 2026-08-12).

## 3. Record check (§1.2) — the gating no longer applied to THIS instance
The truncation class was pinned LOW-urgency + founder-gated on 2026-08-04 — but on PER-CONVERSATION evidence
(max ~38). This instance is different: it truncates a HEADLINE honesty metric at a low session threshold, in
both views the honesty thesis explicitly depends on being consistent. So I did NOT act unilaterally; I surfaced
the severity mismatch and the founder authorized the fix. (Earlier I was corrected for fixing a class instance
BEFORE record-checking — here the record-check + explicit founder authorization both precede the fix.)

## 4. Complete-sweep check (A26) — the class had MORE instances than first flagged
The first flag named three reads in /me (cues/outcomes/segments). Enumerating EVERY `.from(...).in/.eq(...)`
read on a usage-growth table in both routes found the real count: **/me has 4** (adds `after_pitch_summaries`
at line 96, feeding the Layer-3 quality/talk/skill metrics) and **/team has 3** (cues, segments,
after_pitch_summaries). All seven are fixed — not just the three that surfaced the finding (avoiding the
incomplete-sweep overclaim this session was already caught on twice).

## 5. The fix
Wrap each of the seven reads in `fetchAllPaged` with a `.order("id")` on each table's uuid `id` PK (verified in
migrations 0070/0080 — all four tables have `id uuid primary key`), so range paging returns every row exactly
once. Error handling is preserved as the routes intended (`.catch(() => null)` → the existing `?? []`), so ONLY
truncation changed. `fetchAllPaged` throws on a read error and has a 200k backstop; its paging behaviour is
already unit-tested (paginate.test.ts), so this build locks that the routes USE it (paged-reads.test.ts).

## 6. Hypotheses (§1.5.2)
- **H1 — does paging change small-dataset results (the existing tests)?** No: a <1000-row table ends
  fetchAllPaged after one short page, identical to the single read. The me-route integration tests (≤5
  sessions) are unchanged. CONFIRMED (27 KPI tests green, incl. the 78-test broader KPI suite earlier).
- **H2 — is there a residual beyond result-truncation?** Yes: a rep past ~1000 SESSIONS makes `sessionIds`
  itself a >1000-value `.in()` list (URL-length / PostgREST limit) — a SEPARATE, rarer concern that
  fetchAllPaged's own doc flags; the real fix there is a server-side aggregate RPC. Documented as a residual,
  not solved here (the primary bug bites at ~25-30 sessions, far below 1000). CONFIRMED by reading the helper doc.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T07:00:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the root cause (the 1000-cap on the dependent reads) before fixing.", "how_this_build_will_embody_it": "Section 2 traces the exact reads + why the metric is wrong." },
  { "id": "§0.1", "read_at": "2026-08-12T07:00:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T07:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective — the class is recorded; check whether the gating applies to THIS instance.", "how_this_build_will_embody_it": "Section 3 record-checks the 08-04 gating + the founder's explicit authorization." },
  { "id": "§1.5.1", "read_at": "2026-08-12T07:01:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — fix the whole class in both routes, not the one read that surfaced it.", "how_this_build_will_embody_it": "Enumerated + fixed all seven usage-growth reads across me + team." },
  { "id": "§1.5.2", "read_at": "2026-08-12T07:01:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive — THINK about the residual (>1000-id .in list) before claiming done.", "how_this_build_will_embody_it": "H2 identifies + documents the >1000-session .in()-list residual." },
  { "id": "§3.4", "read_at": "2026-08-12T07:01:50Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a truncated headline metric presented as real is the core thesis failure.", "how_this_build_will_embody_it": "The metric now reads the full set; error handling preserved (no new swallow introduced)." },
  { "id": "§3.5", "read_at": "2026-08-12T07:02:00Z", "source_file": "CLAUDE.md", "line_range": "294-330", "why_it_governs": "Measurement — the reliance metric must measure the real thing, not a 1000-row sample.", "how_this_build_will_embody_it": "coachedSessions + cue aggregation now see every row." },
  { "id": "§6", "read_at": "2026-08-12T07:02:15Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — record-check + holistic before acting.", "how_this_build_will_embody_it": "Sections 3-5 run it; founder authorization obtained." },
  { "id": "A19", "read_at": "2026-08-12T07:00:45Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree.", "how_this_build_will_embody_it": "Read both routes + fetchAllPaged + the migrations in-tree before changing them." },
  { "id": "A22", "read_at": "2026-08-12T07:02:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-12T07:02:45Z", "source_file": "ThinkerThinker.md", "line_range": "66-72", "why_it_governs": "A found bug is one instance of a class — sweep it completely.", "how_this_build_will_embody_it": "Enumerated every usage-growth read; fixed all seven, not the three that surfaced." },
  { "id": "A30", "read_at": "2026-08-12T07:02:50Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson in a test so it can't silently regress.", "how_this_build_will_embody_it": "paged-reads.test.ts locks all seven reads inside a fetchAllPaged(...).range(...) window; a revert to unbounded fails it." },
  { "id": "A38", "read_at": "2026-08-12T07:03:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check runs with exit codes." }
]
```
