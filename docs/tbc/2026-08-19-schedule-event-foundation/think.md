---
title: Schedule Management System — Phase 1 (Event Store & Derivation Foundation)
build_plan: ScheduleManagementSystem.md (revised, Supabase/Vercel/DeepSeek stack)
phase: 1 of 8
started_at: 2026-08-19T00:00:00Z
manifest_entries: 23
---

# Phase 1 — Event Store & Derivation Foundation

## Step 1 — Document integrity (§0.1 / A19) — MATCH
`sha256sum` + `wc -l` of CLAUDE.md (`3325eedc…`, 480 lines) and ThinkerThinker.md (`19d6ff10…`, 1068 lines)
match `docs/tbc/DOC_MANIFEST.json` exactly (regenerated 2026-08-14 on AMD-011). No unbacked constitutional
drift. Proceed.

## Step 2 — Session-read manifest (A22 / A35)

Each clause opened THIS session (not cached). Timestamps are in-session reads.

```json
[
  { "id": "§0",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",  "why_it_governs": "Understanding precedes solving — a scheduling authority fed more intelligence through a bad identification produces confident wrong denials/approvals faster.", "how_this_build_will_embody_it": "Phase 1 builds ONLY the foundation I can fully justify (event log + pure projector + replay proof); no rules/AI until it is proven." },
  { "id": "§0.1",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",  "why_it_governs": "Methodology-in-tree precondition; CAT-001 is why.", "how_this_build_will_embody_it": "Ran find + sha256 + wc; read A39/A40/A41/A19/A22/A28/A30/A31/A38 + §1.5.1 from the tree this session before writing a file." },
  { "id": "§1.5.1", "read_at": "2026-08-19T00:51:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer sieve — a layer-1 (schema/derivation) flaw is not survivable above; the whole system rests on the event log being right.", "how_this_build_will_embody_it": "Section 5 walks the four layers; Phase 1 is layer-1 and is proven (replay determinism test) before Phase 2 constraints consume it." },
  { "id": "§1.5.2", "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — form failure hypotheses before grepping.", "how_this_build_will_embody_it": "Section 3 lists 6 hypotheses (append-only enforcement, seq monotonicity, replay determinism, tenancy, tz, projector purity) written before the precedent greps that confirm/deny them." },
  { "id": "§2",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "232-258", "why_it_governs": "Surface don't overtake; interrogate locked doors; explain the WHY.", "how_this_build_will_embody_it": "Q1–Q6 surfaced with recommendations, not chosen silently; append-only is a REAL locked door enforced at the DB, not picked." },
  { "id": "§2.2",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "275-306", "why_it_governs": "Single-source decisions — consume a verdict, never re-derive (A40).", "how_this_build_will_embody_it": "Phase 1 defers the verdict authority to Phase 3, but the projector is the SINGLE source of derived state so no consumer re-derives shifts from raw events." },
  { "id": "§3.1",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "307-314", "why_it_governs": "Events are immutable; state is derived by replay, never edited in place — the spine of this whole system.", "how_this_build_will_embody_it": "schedule_event is append-only enforced at the DB (revoke UPDATE/DELETE + a raise-trigger); deriveState() is a pure replay; corrections are new events." },
  { "id": "§3.2",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "315-319", "why_it_governs": "The understanding gate is structural — no half-understood problem surfaces.", "how_this_build_will_embody_it": "Deferred to when signals/problems are built (Phase 2+); Phase 1 lays the event source they will read, nothing surfaces yet." },
  { "id": "§3.3",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "320-331", "why_it_governs": "Guide don't overtake — the AI proposes, the human decides.", "how_this_build_will_embody_it": "Phase 1 has no AI/decision; it is inert data plumbing. The append API only records what an authenticated human/actor asserts." },
  { "id": "§3.4",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "332-343", "why_it_governs": "Honesty — fail loud, never dress a failure as no-data.", "how_this_build_will_embody_it": "The append-only enforcement RAISES (loud) rather than 0004's silent do-instead-nothing rule; the append API surfaces a real error, never a false ok." },
  { "id": "§6",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "402-440", "why_it_governs": "Quick-decision checklist — precondition gate, holistic trace, WHY.", "how_this_build_will_embody_it": "Ran 1a (methodology in tree, read this session), 5c (external config: tz/env flagged), and the append-only/verdict items apply from Phase 1 forward." },
  { "id": "A19",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology must be in the tree and read in-session, not cited from cached labels.", "how_this_build_will_embody_it": "Verified both docs in-tree + hash-matched + read the assets this session before citing them." },
  { "id": "A22",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-631", "why_it_governs": "Citations without session-reading are undetected violations; the manifest is the shipping artifact that closes the speed gap.", "how_this_build_will_embody_it": "THIS manifest — every cited clause paired with an in-session read_at + a real line_range containing the ID." },
  { "id": "A28",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "736-750", "why_it_governs": "Before flagging an architecture choice as a founder decision, check whether a codebase precedent already decides it.", "how_this_build_will_embody_it": "Grepped tenancy (company_id 166 / org_id 0 → build with company_id) and the append-only idiom (0004/0010 → mirror it). Q4 converted from flag to alignment." },
  { "id": "A30",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-789", "why_it_governs": "A lesson in prose returns — encode the class in a GATE that fails without the author's cooperation.", "how_this_build_will_embody_it": "Append-only is a DB trigger (not a comment); replay determinism is a unit test (not a promise); both fail loudly on regression." },
  { "id": "A31",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "792-805", "why_it_governs": "Schema-complete is not built — a table nothing reads/writes is dead config promising a control that doesn't exist.", "how_this_build_will_embody_it": "DECISION D2 below: Phase 1 does NOT persist materialized derived-state tables (no read-consumer until Phase 5/6); the pure projector is the source of truth. Building empty projection tables now would be the A31 anti-pattern." },
  { "id": "A38",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1021", "why_it_governs": "'Verified' is a claim about the canonical command you ran, reported as coverage not verdict.", "how_this_build_will_embody_it": "Step 8 runs `npm run check` by name and pastes its output + exit code + coverage (all six / N-of-six), never a self-scoped subset called 'verified'." },
  { "id": "A39",    "read_at": "2026-08-19T00:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "1025-1042", "why_it_governs": "Multi-party text must carry per-party attribution at the source.", "how_this_build_will_embody_it": "schedule_event stores actor_id at the source; when the Phase-4 LLM parses a request, the event records WHO requested it — attribution is upstream, not reconstructed." },
  { "id": "A40",    "read_at": "2026-08-19T00:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "1044-1055", "why_it_governs": "A decision is a returned verdict, consumed — never re-derived by a downstream consumer.", "how_this_build_will_embody_it": "Phase 1 establishes the single projector; Phase 3 will add the single verdict authority. No coverage math exists in Phase 1 to be duplicated." },
  { "id": "A41",    "read_at": "2026-08-19T00:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "1057-1066", "why_it_governs": "Correctness depending on external config fails silently unless verified or flagged, fail-loud.", "how_this_build_will_embody_it": "Section 4 flags org-timezone (no companies.timezone column exists — VERIFIED absent) and per-env Supabase/DeepSeek as blocking preconditions; recorded, not assumed." },
  { "id": "§5",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "360-401", "why_it_governs": "Knowledge != intelligence; the builder under pressure is the biggest risk; deterministic vs LLM split.", "how_this_build_will_embody_it": "Phase 1 is entirely deterministic; no LLM. I resisted the guard's pressure to build ahead — Phase 1 only, stop at its checkpoint." },
  { "id": "A20",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "479-503", "why_it_governs": "'Founder decision needed' can be the agent offloading its own quality bar — take the lead on the obvious default with reasoning, invite override.", "how_this_build_will_embody_it": "Q4/D1/D2 were not left as bare 'you decide' — each carries a recommendation + its A28/A31 grounding, and I proceeded on the well-founded default rather than stalling." },
  { "id": "A35",    "read_at": "2026-08-19T00:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "899-916", "why_it_governs": "The manifest hook charges for the CITATION not the reliance — a green trailer only certifies what you named you read; ask which clauses you leaned on without naming.", "how_this_build_will_embody_it": "This manifest names every clause the build leans on (3.1/2.2/3.4/A28/A30/A31/A38/A22/A19/1.5.1), not just the convenient ones; I read A35 itself before citing it rather than quoting the label." }
]
```

## Step 3 — Hypotheses before search (§1.5.2)

- **H1 (append-only silently unenforced).** Claim: a plain table lets a future writer UPDATE a past event, breaking §3.1. Confidence 0.9. Search: precedent for DB-level enforcement → CONFIRMED (0004 uses `do instead nothing` rules; 0010 similar). Resolution: enforce with a **raise-trigger + revoke** (the plan's fail-loud choice, stronger than 0004's silent rule).
- **H2 (seq not monotonic / race).** Claim: concurrent appends could collide or reorder. Confidence 0.6. Search: how 0004 orders (occurred_at only, no seq). Resolution: a per-company monotonic `seq` via a sequence or `count`-based assignment is race-prone; use a table-wide `bigserial seq` (globally monotonic, gap-tolerant) — ordering within a company is `seq ASC`.
- **H3 (replay non-determinism).** Claim: replaying the same log twice yields different derived state (map ordering, Date.now, floating). Confidence 0.5. Mitigation: projector is a PURE function of `events[]` sorted by seq; no clock, no random; test asserts `deriveState(log) === deriveState(log)` deep-equal + order-independent input tolerance.
- **H4 (tenancy drift).** Claim: using `org_id` invents a parallel tenancy key. Confidence 0.8. Search: company_id 166 / org_id 0 → CONFIRMED. Resolution: `company_id`, mirror `auth_company_id()` RLS.
- **H5 (tz correctness, A41).** Claim: shift times depend on org timezone that isn't stored. Confidence 0.7. Search: no `companies.timezone` column → CONFIRMED absent. Resolution: FLAG as a Phase-2 precondition (shift-time math starts there); Phase 1 stores instants/dates as given, no tz math yet.
- **H6 (projector coupled to DB).** Claim: deriveState reads the DB directly, so it can't be unit-tested or replayed. Confidence 0.6. Resolution: deriveState is pure `(events) => state`; the API/route does the IO and hands events in. Testable without a DB.

## Step 4 — Spec fidelity + precedent (A28)

**Restated:** Phase 1 = the append-only `schedule_event` log + a pure deterministic projector `deriveState(events)` + an append API (validate, never mutate, monotonic seq) + a replay proof. It is the foundation; rules (Phase 2), the verdict authority (Phase 3), the AI layer (Phase 4), and the interfaces (5–6) build on top and are NOT in scope here.

**Precedent-decided (A28 — build, don't flag):**
- **Tenancy = `company_id`** (166 vs 0). The plan's `org_id` maps to it.
- **Append-only idiom** mirrors `0004_events.sql` — but with the plan's **raise-trigger** (fail-loud) instead of 0004's silent `do instead nothing` (a deliberate §3.4 improvement, spec-as-written).

**Two flagged interpretations (proceeding on the well-founded default per A20/A28/A31; override welcome):**
- **D1 — `schedule_event` is a NEW table (Q3), not the generic `events`.** Spec-as-written + cleaner domain payloads/seq/RLS. Building it.
- **D2 — Phase 1 does NOT persist materialized derived-state tables.** The plan step 1 lists them, but A31 forbids schema with no read-consumer (Phase 5/6 are the readers). The pure projector fully meets Phase 1's acceptance (replay → identical derived state). Materialized projections + their refresh model are built when a consumer needs them. This is a scoping call grounded in A31, flagged BEFORE acting (spec-fidelity) — not a silent deviation.

**Deferred to their phases (not Phase-1 blockers):** Q1 (coverage override → Phase 3), Q2 (auto-approve → Phase 3/5), Q5 (employee = user vs lightweight record → **needed before Phase 2**; Phase 1 treats employee_id as an opaque UUID in the payload, so it is decision-independent here).

## Step 5 — Four-layer pre-walk (§1.5.1)

Phase 1 is **not user-facing** (no surface yet) — it is the layer-1 substrate. Walking it anyway:
1. **Build structure:** event table + pure projector + typed events. Sound, replayable, maintainable. The seam every later phase reads.
2. **Operational effect:** "invoked as a real caller would" = the append API records an event and the projector derives correct state; proven by the replay test, not just a unit assertion.
3. **Synergetic completeness:** Phase 1's "consumer" is Phase 2 (constraints) — it lands them a clean, replayable state source, no dead end. There is no human workflow to strand yet.
4. **Surface:** none in Phase 1 (deferred to Phase 5–6).

**Verdict: SHIPPABLE as a foundation** (layers 1–2 proven; 3 is inter-phase continuity; 4 N/A). A user-facing surface is explicitly out of Phase-1 scope, so the layer-4 absence is a scope boundary, not a gap.
