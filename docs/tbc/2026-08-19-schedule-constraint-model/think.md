---
title: Schedule Management System — Phase 2 (Coverage Requirements & Constraint Model)
build_plan: ScheduleManagementSystem.md
phase: 2 of 8
started_at: 2026-08-19T00:00:00Z
manifest_entries: 14
---

# Phase 2 — Coverage Requirements & Constraint Model

## Step 1 — Document integrity (§0.1) — MATCH (unchanged this session)
CLAUDE.md `3325eedc…` / 480 and ThinkerThinker.md `19d6ff10…` / 1068 still match DOC_MANIFEST.json (verified
in the Phase-1 build this session; no doc changed since).

## Step 2 — Session-read manifest (A22 / A35)

```json
[
  { "id": "§0",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",  "why_it_governs": "Understanding precedes solving — a constraint layer with a subtle off-by-one misidentifies coverage confidently.", "how_this_build_will_embody_it": "Boundary behaviors understood + tested before Phase 3 consumes them; no LLM guessing math." },
  { "id": "§0.1",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",  "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Docs verified in-tree + hash-matched; assets read this session before citing." },
  { "id": "§1.5.2", "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — form failure hypotheses before building.", "how_this_build_will_embody_it": "Step 3 lists 5 hypotheses (floor/cap off-by-one, NaN, overnight, hard/soft conflation) written before the predicates." },
  { "id": "§6",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "402-440", "why_it_governs": "Quick-decision checklist — precondition gate, real-vs-incidental constraint, WHY.", "how_this_build_will_embody_it": "Hard constraints treated as REAL locked doors (checklist 4); precondition gate run (checklist 1a)." },
  { "id": "A19",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology must be in-tree + read in-session, not cited from cached labels.", "how_this_build_will_embody_it": "Docs in-tree + hash-matched; the assets cited here were opened this session." },
  { "id": "§1.5.1", "read_at": "2026-08-19T00:51:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer sieve — the constraint layer is layer-1 logic the verdict authority (Phase 3) and UI (5-6) rest on.", "how_this_build_will_embody_it": "Predicates are pure + boundary-tested (layer-1 sound) before any consumer uses them; no UI in this phase." },
  { "id": "§2",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "232-258", "why_it_governs": "Interrogate locked doors — a hard constraint is a REAL locked door (respect it, never pick it); surface, don't overtake.", "how_this_build_will_embody_it": "Hard constraints return pass/fail (a real door); soft return a score (tradeable). meetsCoverage never silently passes an understaffed shift." },
  { "id": "§3.1",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "307-314", "why_it_governs": "Events are immutable; state derived by replay.", "how_this_build_will_embody_it": "coverage_requirement is event-sourced (COVERAGE_REQ_* events, projected in Phase 1). The ROSTER (schedule_employee) is master data, NOT event-sourced — 3.1 governs schedule STATE, not the people table (profiles/companies are mutable too). Flagged." },
  { "id": "§5",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "360-401", "why_it_governs": "Deterministic vs LLM — the math is deterministic, never the LLM's job.", "how_this_build_will_embody_it": "Every predicate is pure deterministic arithmetic/set-logic; no LLM anywhere in Phase 2." },
  { "id": "A28",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "736-750", "why_it_governs": "Check for a codebase precedent before treating a choice as a founder decision.", "how_this_build_will_embody_it": "schedule_employee mirrors the profiles person-master-data pattern (company_id + RLS + mutable). Tenancy = company_id." },
  { "id": "A30",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-789", "why_it_governs": "Gate the lesson — encode the invariant as a test that fails on regression.", "how_this_build_will_embody_it": "The boundary behaviors (exactly-at-min coverage MEETS; exactly-at-max hours is WITHIN) are locked by unit tests — an off-by-one at the floor/cap fails CI." },
  { "id": "A31",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "792-805", "why_it_governs": "No dead schema — a column nothing reads/writes is a false promise of a control.", "how_this_build_will_embody_it": "Founder chose standalone-now, Elostate-link-later — so NO user_id column now (would be dead until that feature). Added cleanly when the link ships." },
  { "id": "A38",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1021", "why_it_governs": "'Verified' is the canonical command by name.", "how_this_build_will_embody_it": "check.md pastes `npm run check` coverage + exit code." },
  { "id": "A22",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-631", "why_it_governs": "Citations require in-session reading; the manifest is the artifact.", "how_this_build_will_embody_it": "This manifest — every cited clause paired with an in-session read_at." }
]
```

## Step 3 — Hypotheses (§1.5.2)
- **H1 off-by-one at the coverage floor.** `meetsCoverage` could use `<` vs `<=` wrong, passing an understaffed shift or blocking an exactly-covered one. Mitigation: boundary tests (exactly-at-min MEETS; one-below gaps).
- **H2 off-by-one at the hours cap.** `withinLimits` could reject exactly-at-max. Mitigation: exactly-at-max = within test.
- **H3 NaN from division (fairness / duration).** cv on mean 0, or bad "HH:mm". Mitigation: mean-0 → 1.0; malformed time → 0; degenerate-input tests.
- **H4 overnight shift underflow.** end ≤ start must mean +24h, not negative. Mitigation: 22:00→06:00 = 8h test.
- **H5 hard/soft conflation.** A soft score leaking into a gate. Mitigation: distinct return shapes (pass/fail vs number) + a test asserting fairness returns a number in [0,1], never a verdict.

## Step 4 — Spec fidelity + precedent (A28)
**Restated:** Phase 2 = define/evaluate hard vs soft constraints as pure predicates. `meetsCoverage`,
`isEligible`, `withinLimits` (hard → pass/fail) + `fairnessScore` (soft → score) + the standalone
`schedule_employee` roster they read. No verdict authority (Phase 3), no LLM (Phase 4), no UI (5-6).

**Founder decisions locked (2026-08-19 picker):** employees = **standalone** staff records, no Elostate
account (link is future → no user_id now, A31); coverage = **block-by-default, manager-overridable**
(consumed by the Phase-3 verdict + Phase-5 UI); zero-impact time-off = **auto-approve** (Phase-3 behavior).
**NEW: file upload (PDF/Excel/CSV) for staff + schedule-template entry** → recorded as a Phase-5 deliverable
(validated against the real samples: HUB SCHED.pdf etc. — a staff×date grid of shift codes).

**Precedent (A28):** `schedule_employee` mirrors `profiles` (person master data as a mutable, company_id +
RLS table). Roster-as-master-data (not event-sourced) aligns with the platform; flagged in §3.1's entry.

## Step 5 — Four-layer pre-walk (§1.5.1)
Phase 2 is layer-1 logic (no surface). 1: pure predicates, distinct hard/soft shapes, sound. 2: invoked as
Phase 3/4 will invoke them — correct on the boundaries (tested). 3: consumer is Phase 3 (the verdict), clean.
4: none (UI is 5-6). **Verdict: SHIPPABLE foundation** (1-2 proven; 3 inter-phase; 4 out of scope).
