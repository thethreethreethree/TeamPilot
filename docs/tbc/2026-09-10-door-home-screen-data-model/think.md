---
started_at: 2026-09-10T06:38:15+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — door home screen, Phase 04: data model + read layer

## Why (the record)
Increment 2 of the phased door-home-screen build (decisions in INSPECTION.md; Phase 05 engine already shipped,
merge 52cafbf6). This phase is `04-data-model.md`: the storage the screen reads, and the layer that feeds the
engine. Founder chose to build it now and apply the migration AFTER review.

## Understanding
`04-data-model.md`'s rule is "extend what exists; do not duplicate it." The inspection (INSPECTION.md Q2) found
the three funnel facts ALREADY stored — `door_knocks` (knock events + outcome, with `local_date`), `pitches`
(a presentation = a recorded pitch), and a `rep_kpi_daily` VIEW. So this phase adds NO activity table. What is
genuinely new:
- **rep_daily_sales_goal** — the standing per-rep daily sales goal a MANAGER sets (Q1). RLS mirrors 0215's
  same-company-manager predicate; a rep may READ their own but only a manager WRITES.
- **rep_day_target** — the FROZEN targets per rep per local day (03/05: a target that moves during the day
  rewards stopping). PK (rep_id, local_date); the rep freezes their own on first open; managers may read.
- **dayTargetData.getOrFreezeDayTarget** — reads the frozen row (never recompute intra-day), else reads the
  goal + computes 30-day close/contact ratios from door_knocks/pitches, calls the pure engine, and freezes.
  "Qualified" = ≥10 presentations AND ≥1 sale in the window (one sale is not a ratio).

## Ripple (§1.5)
- No new source of truth for doors/presentations/sold — they stay in door_knocks/pitches; this only ADDS the
  goal + the frozen target. Two rows for the same sale (04's failure mode) is avoided by construction.
- Uses the CALLER-SCOPED db so RLS is the access control (rep sees own; manager reads team). The manager-write
  goal policy reuses the exact 0215 predicate — no new authz shape invented.
- Migration NOT applied yet (founder reviews first); the engine on main stays unreached until the UI phases.
- Honest date-source note: doors/sold filter by local_date, presentations by recorded_at (pitches carry no
  local_date); a 30-day ratio does not need day-exact precision — documented so it isn't mistaken for a bug.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The existing door_knocks/pitches schema + RLS were read before the migration; the new tables extend, never duplicate." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-44", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Governing docs in-tree; hashes pinned." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "288-296", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Trace ripple before committing.",
    "how_this_build_will_embody_it": "No new source of truth; caller-scoped RLS; migration held for review — all traced above." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Layer-1 structure — will it stay maintainable.",
    "how_this_build_will_embody_it": "Reuses existing tables + the exact 0215 RLS predicate; the frozen-target table is a small additive shape." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "THINK first, then confirm.",
    "how_this_build_will_embody_it": "The freeze-idempotency race (two opens same day) was designed for up front (PK + insert-only + no-op on conflict)." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-380", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "No fabrication — an honest empty state over an invented number.",
    "how_this_build_will_embody_it": "No manager goal → the empty state is returned and NOT frozen; a fabricated target is never stored." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-448", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Founder decisions via picker; a prod migration is applied on the founder's word.",
    "how_this_build_will_embody_it": "Built now, but 0247 is NOT applied — the founder reviews first (their picker choice)." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Cited ranges opened this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Cited clauses read in-session.",
    "how_this_build_will_embody_it": "Each entry has an in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "The three read paths (frozen / no-goal / compute+freeze) are pinned by tests." },
  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "872-890", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "Migration-coupled code keeps a guarded fallback; never assert the migration is applied.",
    "how_this_build_will_embody_it": "The migration is unapplied; the read layer's queries will fail LOUD (not fabricate) until 0247 lands — the UI phases wire it only after apply." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-10T06:38:25+08:00",
    "why_it_governs": "'Verified' names the command actually run.",
    "how_this_build_will_embody_it": "check.md pastes npm run check output + exit code and the db:dry result (pending, not applied)." }
]
```
