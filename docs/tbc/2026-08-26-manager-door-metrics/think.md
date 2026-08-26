---
started_at: 2026-08-26T09:44:00+08:00
---

# THINK — manager dashboard: per-rep door metrics (knocked / presentations / sold)

## The ask + the constitutional check FIRST (A18)
Founder (Moses): "show their door metrics on the manager dashboard — doors knocked, sales presentation, sales."
This surfaces PER-REP human-behavior data to a leader, which A18 governs: the LABEL is the structural defense
against misuse. The team-analytics route is deliberately AGGREGATE-ONLY (§A18 — no coaching leaderboard). But
door metrics are OBJECTIVE ACTIVITY/RESULTS (knocked/presentations/sold), NOT the growth-based coaching grade — and
the Coach Assessment page already shows per-rep coaching cards to the manager. So per-rep door ACTIVITY is legitimate
operational manager visibility, distinct from a coaching ranking. It ships on the Coach Assessment page (the manager's
per-rep team view Moses marked), framed as "door activity", alphabetical (no ranking) — A18 honored by label + order.

## Understanding (existing data, verified — not assumed)
`getAllTimeKpi(repId)` ALREADY returns exactly `{doorsKnocked, presentations, sold}`, cap-safe (fetchAllPaged over
`rep_kpi_daily`), with the product's own definition: presentation = a door where the rep actually pitched
(doorsKnocked − no_answer). Verified against real data: reps show e.g. 95/46/20, 126/30/3 — sensible, meaningful.
`rep_kpi_daily` is rep+manager RLS, so a manager can read a team member's rows (per getKpiForDay's note).

## The build (§1.5.1 layers 2 + 4 — works AND surfaces cleanly)
- Route (`coach-assessment/route.ts`): per-rep parallel block adds `getAllTimeKpi(a.id).catch(()=>null)` — BEST-EFFORT
  so a KPI hiccup yields null (NOT a false 0, §3.4) and never degrades the coaching page. `doorKpi` added to each team item.
- Page: a compact `<DoorMetrics>` row on each rep card ("🚪 N knocked · N presentations · N sold"), rendered only when
  there's activity (a quiet rep's card stays clean). The no-coached-sessions list is now per-rep with door metrics too,
  so an ACTIVE rep whose audio didn't capture (the iOS empty-capture class) still shows they're working.

## Ripple (holistic — §6 item 5)
- Additive: a new best-effort query + a display field; the coaching data/degrade path is unchanged.
- No schema change (rep_kpi_daily + getAllTimeKpi already exist). No new auth surface (same manager-gated route).
- §3.4: null-on-error (never a fabricated 0); §A18: labelled "door activity", alphabetical (not a ranked leaderboard).

## A30 gate
Typecheck enforces `doorKpi` on the team item; the existing coach-assessment route test passes (the .catch keeps
doorKpi null when the KPI read isn't mocked — proving the best-effort path never breaks the team response).

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 09:44:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-26T09:47:20+08:00",
    "why_it_governs": "Understand the data + the A18 constraint before building.",
    "how_this_build_will_embody_it": "Verified getAllTimeKpi's shape + real numbers, and checked the A18/leaderboard boundary, before wiring." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-26T09:47:22+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build (incl. A18)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-102", "read_at": "2026-08-26T09:47:24+08:00",
    "why_it_governs": "Layers 2 + 4 — the metrics must be correct AND surfaced clearly on the manager's view.",
    "how_this_build_will_embody_it": "Uses the verified KPI shape; a compact, activity-only row that stays clean for quiet reps." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-149", "read_at": "2026-08-26T09:53:40+08:00",
    "why_it_governs": "Proactively check the surrounding constraints, not just the literal ask — here, the A18/leaderboard boundary the request touches.",
    "how_this_build_will_embody_it": "Checked the aggregate-only team-analytics principle + framed door metrics as activity, before wiring." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-26T09:47:26+08:00",
    "why_it_governs": "Honesty — a KPI read error must not render as a fabricated 0.",
    "how_this_build_will_embody_it": "Best-effort null on error; the row renders nothing rather than a false 0." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-08-26T09:47:28+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the data, checked A18, traced ripple (additive best-effort)." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-08-26T09:47:15+08:00",
    "why_it_governs": "Surfacing per-rep behavior data to a leader — the LABEL is the defense against misuse.",
    "how_this_build_will_embody_it": "Labelled 'door activity' (objective results, not a coaching rank); alphabetical, not sorted by performance." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-457", "read_at": "2026-08-26T09:47:30+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-596", "read_at": "2026-08-26T09:47:32+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-26T09:47:34+08:00",
    "why_it_governs": "A behavior held only in prose regresses; the honesty-relevant part (best-effort null, never a false 0) must be pinned by something that fails without cooperation.",
    "how_this_build_will_embody_it": "Typecheck enforces the doorKpi field; the route test proves the best-effort null path keeps the team response intact." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-26T09:47:36+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
