---
title: Schedule Management System — Phase 4 part 1 (Resolution Search, deterministic)
build_plan: ScheduleManagementSystem.md
phase: 4 of 8 (deterministic half)
started_at: 2026-08-19T00:00:00Z
manifest_entries: 12
---

# Phase 4 (part 1) — Resolution Search (deterministic)

## Step 2 — Session-read manifest (A22 / A35)
```json
[
  { "id": "§0",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",  "why_it_governs": "Understand the whole schedule before proposing a fill.", "how_this_build_will_embody_it": "findResolutions reads full state + roster; reuses the authority's understanding." },
  { "id": "§0.1",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",  "why_it_governs": "The governing methodology must be in the working tree and read this session, not cited from cached labels.", "how_this_build_will_embody_it": "Docs hash-matched against DOC_MANIFEST; every cited asset opened this session." },
  { "id": "§1.5.1", "read_at": "2026-08-19T00:51:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "The four-layer sieve — a layer-1 logic flaw is not survivable by the LLM/UI above it.", "how_this_build_will_embody_it": "Pure, boundary-tested layer-1 search proven before the LLM proposal or the review UI consume it." },
  { "id": "§1.5.2", "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK first about failure modes, then search — hypotheses guide the build, not grep pattern-matching.", "how_this_build_will_embody_it": "Step 3 states re-derivation/rejected-candidate/order hypotheses before the code." },
  { "id": "§3.3",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "320-331", "why_it_governs": "Guide, don't overtake — the AI proposes and the human decides; the AI's voice is a founder-owned product behavior.", "how_this_build_will_embody_it": "The deterministic search only SURFACES candidates; the LLM proposal voice (how it explains + proposes) is deferred to a founder picker, not chosen autonomously." },
  { "id": "§5",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "360-401", "why_it_governs": "Deterministic vs LLM split — the math/search is deterministic; the LLM proposes on top and never overrides it.", "how_this_build_will_embody_it": "findResolutions is pure deterministic set logic; the LLM half (deferred) will only phrase these candidates, never invent or override them." },
  { "id": "A30",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-789", "why_it_governs": "Gate the lesson — a fix is not complete until a test fails on its regression.", "how_this_build_will_embody_it": "6 tests lock the candidate-filtering + fair-load ranking; a regression that proposes an unavailable employee fails CI." },
  { "id": "§2",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "232-258", "why_it_governs": "Find a better room, don't just deny — a gap triggers a search, not a bare refusal.", "how_this_build_will_embody_it": "findResolutions is exactly the 'better room' — eligible/available candidates, never a silent deny." },
  { "id": "§6",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "402-440", "why_it_governs": "Checklist — consume the verdict.", "how_this_build_will_embody_it": "The search reuses evaluateChange (A40), never re-derives eligibility." },
  { "id": "A19",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in-tree + read.", "how_this_build_will_embody_it": "Assets opened this session." },
  { "id": "A22",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-631", "why_it_governs": "Citations require reading.", "how_this_build_will_embody_it": "This manifest." },
  { "id": "A38",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1021", "why_it_governs": "Verified = the command by name.", "how_this_build_will_embody_it": "check.md pastes npm run check + exit code." }
]
```
Also governing (read this session, cited elsewhere): A30 (the search is test-gated), A40 (reuse the verdict).

## Step 3 — Hypotheses (§1.5.2)
- **H1 the search re-derives eligibility** (drift vs the gate). Mitigation: it calls evaluateChange — same condition as approval.
- **H2 a proposed candidate the gate would reject.** Mitigation: only `approvable` candidates are returned (proven by the double-book / time-off / over-hours exclusion tests).
- **H3 non-deterministic order.** Mitigation: sort by currentHours then name (stable); tested.

## Step 4 — Spec fidelity
Phase 4 = LLM parse (step 1) + resolution search (step 2, DETERMINISTIC) + LLM propose (step 3). THIS build is
step 2 only. Steps 1+3 (the LLM half — the AI's voice) are deferred to a founder voice decision (§3.3 guide-
don't-overtake — the tone/approach of the AI's proposal is founder-critical, flagged not chosen).

## Step 5 — Four-layer
Pre-surface layer-1 logic. 1: pure, reuses the authority. 2: correct candidate filtering (tested). 3: consumer
is the LLM proposal (step 3) + the Phase-5 review UI. 4: none. **SHIPPABLE foundation.**
