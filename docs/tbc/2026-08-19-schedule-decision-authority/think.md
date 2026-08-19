---
title: Schedule Management System — Phase 3 (The Decision Authority)
build_plan: ScheduleManagementSystem.md
phase: 3 of 8
started_at: 2026-08-19T00:00:00Z
manifest_entries: 12
---

# Phase 3 — The Decision Authority (A40 / §2.2 — the money rule)

## Step 1 — Document integrity (§0.1) — MATCH (unchanged this session)

## Step 2 — Session-read manifest (A22 / A35)

```json
[
  { "id": "§0",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",  "why_it_governs": "Understanding precedes solving — the authority must UNDERSTAND the whole schedule (replay) before it judges a change.", "how_this_build_will_embody_it": "evaluateChange reads the full derived state + roster; it does not judge from a fragment." },
  { "id": "§0.1",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",  "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Docs hash-matched; assets read this session." },
  { "id": "§1.5.1", "read_at": "2026-08-19T00:51:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer sieve — the verdict is layer-1 the UI (5-6) rests on.", "how_this_build_will_embody_it": "Pure authority, drift-guard tested, before any UI consumes it." },
  { "id": "§1.5.2", "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search.", "how_this_build_will_embody_it": "Step 3 hypotheses on term-drift + the override branch before writing the authority." },
  { "id": "§2.2",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "275-306", "why_it_governs": "Single-source decisions — compute the verdict once, consume it; never re-derive (A40).", "how_this_build_will_embody_it": "evaluateChange is the ONE authority; grep proves meetsCoverage/isEligible/withinLimits are called only inside it." },
  { "id": "§5",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "360-401", "why_it_governs": "Deterministic vs LLM — the gate is deterministic; the LLM never overrides it.", "how_this_build_will_embody_it": "The authority is pure arithmetic/set logic; Phase 4's LLM will propose ON TOP, never override." },
  { "id": "§6",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "402-440", "why_it_governs": "Quick-decision checklist — consume the verdict, don't re-derive the gate.", "how_this_build_will_embody_it": "Checklist item on §2.2/A40 applied; single authority + verdict." },
  { "id": "A19",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in-tree + read in-session.", "how_this_build_will_embody_it": "Assets opened this session before citing." },
  { "id": "A22",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-631", "why_it_governs": "Citations require in-session reading; manifest is the artifact.", "how_this_build_will_embody_it": "This manifest." },
  { "id": "A30",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-789", "why_it_governs": "Gate the lesson — a test that fails on regression.", "how_this_build_will_embody_it": "The drift-guard test exercises BOTH branches of every term incl. the override (overridable coverage vs absolute conflict)." },
  { "id": "A38",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1021", "why_it_governs": "'Verified' is the canonical command by name.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit code." },
  { "id": "A40",    "read_at": "2026-08-19T00:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "1044-1055", "why_it_governs": "A decision is a returned VERDICT, consumed — never re-derived; duplicated conditions drift + a dropped term defeats the gate.", "how_this_build_will_embody_it": "evaluateChange returns an explicit Verdict; grep-proven single source; drift-guard test on both branches of the override term (the term most likely dropped in a copy)." }
]
```

## Step 3 — Hypotheses (§1.5.2)
- **H1 term drift.** A second copy of the coverage/eligibility condition would drift. Mitigation: ONE authority; grep proves no re-derivation.
- **H2 override term dropped.** The `overridable` distinction (coverage=overridable vs conflict=absolute) is the term A40 says is added late + forgotten in a copy. Mitigation: drift-guard test asserts BOTH branches — a coverage-only gap is approvable-with-override; an absolute conflict is not approvable; a mix → absolute dominates.
- **H3 status-term inversion.** "approved" time-off blocks, "requested" must NOT. Mitigation: a test asserts a requested time-off does not block while an approved one does.
- **H4 hours double-count.** weeklyHoursOf could miss/double an assignment. Mitigation: over-hours boundary test.

## Step 4 — Spec fidelity + precedent
**Restated:** Phase 3 = ONE `evaluateChange(change, ctx) → Verdict{approvable, autoApprovable, violations,
affectedShifts, reason}`. Composes Phase-2 predicates + the state-dependent hard checks (double-booking,
time-off overlap — S1 from Phase 2) + the founder's override/auto-approve semantics. No LLM (Phase 4), no
UI (5-6). Precedent (A40): the platform's own runBrainCall/call verdict pattern — return a verdict, consume it.

## Step 5 — Four-layer pre-walk
Pre-surface layer-1. 1: one pure authority, explicit Verdict. 2: invoked as Phase 4/5 will — correct on every
branch (drift-guard). 3: consumer is Phase 4 (proposal) / Phase 5 (review UI). 4: none.
**Verdict: SHIPPABLE foundation.**
