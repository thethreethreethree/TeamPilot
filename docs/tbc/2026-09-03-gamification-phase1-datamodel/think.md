---
started_at: 2026-09-03T11:20:00+08:00
---

# THINK — Gamification Phase 1 (data model): append-only points ledger + manager notifications

## Why (founder feature + Phase-0 inspection)
Founder: build the sales-gamification plan (docs/sales-gamification/). Its Phase 0 (mandatory inspection) produced
`docs/gamification/FINDINGS.md` — which found the plan's core assumption FALSE: this repo (Sales Coach) ALREADY
scores every session on dimensions with verbatim citations (`src/lib/coach/v5/salesScore.ts` → after_pitch scores),
plus a self-ELO, letter grades, and a KPI system. Founder decisions (docs/gamification/DECISIONS.md): REUSE the
existing scores (no second judge — §2.2), GAMIFY WITHIN PRIVACY (per-session detail stays rep-private per A18;
board shows rank+totals only), POINTS-primary sort.

## Understanding (§0, §1.7 ground-up inspection, §2.2 single-source)
Because scoring exists, Phase 1 is NOT the plan's session_scores judge table — it is exactly two NEW tables:
- `agent_point_ledger` — append-only; `SUM(points)` per (agent, period) IS the total (never a cached counter that
  drifts). Points are DERIVED from the existing after-pitch scores (Phase 2 maps them); the ledger just banks them.
- `manager_notifications` — in-app, exactly two types (strong_session ≥ threshold, deal_closed). Recipient = a
  company admin (FINDINGS item 8: there is NO per-agent manager FK; alerts fan out to company admins).
Privacy (A18): the ledger rows are owner+manager-readable only; the company-wide rank+totals board (Phase 5) reads
a dedicated aggregate VIEW (not built here) so no per-session detail leaks to peers.

## The build (mirror the repo, don't template)
- Migration 0242: the two tables + a RAISING append-only trigger on the ledger (mirrors fin_entries_immutable 0118
  — loud, not the silent do-instead-nothing rule, because a silent no-op on a "points balance update" hides the
  bug an angry agent finds). Unique `session_score` per session (no double-bank). Company-scoped RLS via
  `auth_company_id()` mirroring 0084. Service-role-only writes (no client insert/update policy).
- Types + constants: `src/lib/coach/gamification/rubric.ts` — RUBRIC_VERSION, POINTS_DIMENSIONS (reuse the existing
  ScoreKeys, not invented), POINTS_SCALE_MAX=100, STRONG_SESSION_THRESHOLD=80, contiguous BANDS, row types. No
  logic (the mapping is Phase 2).

## Verification (§1.5.1 layer-2, A38)
`npm run db:apply` → 30/30 live invariants (new tables passed tenant-isolation + RLS). `npm run typecheck` clean.
Behavioral proof in a ROLLED-BACK transaction (`scripts/verify-gamification-ledger.mjs`, 5/5): insert ok, UPDATE
raises append-only, DELETE raises append-only, double-bank blocked, correction row allowed — nothing persisted
(the trigger blocks DELETE for everyone, so a committed test row would be permanent; rollback is mandatory).
Config test 5/5 (bands cover 0..100 contiguously, threshold at the strong band).

## Session-read manifest (A22 — read_at ≥ started_at 11:20; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T11:25:02+08:00",
    "why_it_governs": "Understanding precedes solving — Phase 0 inspected the real system before designing against it.",
    "how_this_build_will_embody_it": "FINDINGS.md drove the design: reuse existing scores, no duplicate judge." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T11:25:05+08:00",
    "why_it_governs": "Methodology in the tree, consulted this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; cited axioms re-opened this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T11:25:08+08:00",
    "why_it_governs": "Layer-2 effectivity — the tables must actually enforce the invariants, proven.",
    "how_this_build_will_embody_it": "Behaviorally verified append-only + no-double-bank in a rolled-back tx, not asserted." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-03T11:25:11+08:00",
    "why_it_governs": "Reuse the repo's patterns, don't template.",
    "how_this_build_will_embody_it": "Mirrored fin_entries_immutable (raising trigger) + 0084 company-scoped RLS + events append-only discipline." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "244-270", "read_at": "2026-09-03T11:25:14+08:00",
    "why_it_governs": "Ground-up audit before a major structural change.",
    "how_this_build_will_embody_it": "Phase 0 inspected foundation→scoring→RLS and surfaced the existing-scoring + privacy findings before code." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T11:25:17+08:00",
    "why_it_governs": "Single-source — don't fork a second scoring engine.",
    "how_this_build_will_embody_it": "Points REUSE the existing after-pitch scores; the ledger banks a derived total, no second judge." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T11:25:20+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood from the record, surfaced decisions as pickers, traced ripple, verified behaviorally." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T11:25:00+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T11:25:00+08:00",
    "why_it_governs": "Citations require session-reading.",
    "how_this_build_will_embody_it": "Manifest pairs each cited § with a read_at; commit carries the Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T11:25:00+08:00",
    "why_it_governs": "A lesson in prose recurs — encode the invariant in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The append-only + double-bank rules are DB-enforced (trigger + unique index) + behaviorally tested, not prose." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-09-03T11:25:40+08:00",
    "why_it_governs": "Surfacing human-behavior data to a leader — the privacy label/model IS the structural defense against misuse.",
    "how_this_build_will_embody_it": "Per-session score detail stays rep-private; the board shows only rank+totals, preserving the ratified rep-privacy model." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T11:25:43+08:00",
    "why_it_governs": "Retrospective identification from the record (Phase-0 inspected the actual system).",
    "how_this_build_will_embody_it": "The design follows FINDINGS (existing scoring, no manager FK), not assumptions about how such apps are built." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "162-198", "read_at": "2026-09-03T11:25:46+08:00",
    "why_it_governs": "A user-specified experience is layer-2 (carried from the meeting-review PDF commit in range).",
    "how_this_build_will_embody_it": "Not directly exercised here (data model); cited because a same-range commit built the founder-specified PDF experience." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-03T11:25:00+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes db:apply invariants + the rolled-back ledger proof + the config test." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T11:25:49+08:00",
    "why_it_governs": "Honesty — no fabricated numbers; a total is SUM(ledger), never a cached counter.",
    "how_this_build_will_embody_it": "The ledger is append-only + the total is derived, never an editable balance that could drift or be faked." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T11:25:52+08:00",
    "why_it_governs": "Don't soften under pressure; verify before claiming done.",
    "how_this_build_will_embody_it": "Behaviorally proved the append-only + double-bank rules before reporting Phase 1 complete." }
]
```
