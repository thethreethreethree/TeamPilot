---
started_at: 2026-09-03T12:15:00+08:00
---

# THINK — Gamification Phase 5 (the scoreboard UI)

## Why (founder chose Phase 5; the competitive interface is a specified experience)
The founder picked the scoreboard as the next build — the visible payoff. The originating meeting specified a
"competitive interface" that's "easy to understand", so the DESIGN is a user-specified experience (layer-2, AMD-012),
not deferrable polish: it is built AND visually verified.

## Understanding (privacy shapes the data path)
Founder decision: rank + totals PUBLIC to the team, per-session detail PRIVATE (A18). So the board must NOT read the
rep-private ledger rows — it reads an AGGREGATE that exposes only per-agent totals. Built as a SECURITY DEFINER
function (0243) scoped to the caller's company via auth_company_id(), returning one row per agent (rank inputs +
deals), granted to authenticated. One DB query, aggregated in the DB (plan requirement 2 — not N-per-agent, not fetch-all-in-JS).

## The build
- Migration 0243: `gamification_leaderboard(period)` — per-agent sessions / total_points (SUM the ledger, the
  truth) / avg / best + deals (outcome='sold', the LIVE value). D4 sort: points, then avg, then fewer sessions.
- Route `/api/coach/gamification/leaderboard` — auth-gated, validated period, returns rows + the caller's rank.
- UI `Scoreboard.tsx` + `/dashboard/sales-coach/scoreboard` page + a "Scoreboard" nav item (Trophy). Clean
  competitive board: gold/silver/bronze ranks, band chips, deals, your-row highlight, points emphasized. Restraint
  per the plan — no XP bars / levels / streak flames / confetti.

## Verification (layer-2 / AMD-012, A38)
Aggregate previewed against the live seed (Moses 3604/57/9 deals #1, Johns 548/14 #2 — points-primary, sane).
Route: typecheck clean + 4 tests (401, period passthrough, invalid→all, meRank). UI: RENDERED to PNG and read —
clean, competitive, legible board. Nav test still passes (16).

## Out of scope
The agent's own points-trend view (Phase 5 part 3 — the after-pitch already IS the per-session detail view; a trend is
a follow-up). Notifications (Phase 4). Calibration (Phase 6).

## Session-read manifest (A22 — read_at ≥ started_at 12:15; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T12:21:19+08:00",
    "why_it_governs": "Understanding precedes solving — the aggregate/privacy path was designed from the resolved decisions, not assumed.",
    "how_this_build_will_embody_it": "The board reads an aggregate function, honoring the rank-public/detail-private decision." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T12:21:20+08:00",
    "why_it_governs": "The methodology defining understanding must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; cited axioms re-opened this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T12:21:21+08:00",
    "why_it_governs": "Retrospective identification — matched the existing dashboard/nav/RLS patterns from the record.",
    "how_this_build_will_embody_it": "Nav item added to SalesCoachShell; page renders under the existing layout; RPC mirrors 0084 scoping." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T12:21:22+08:00",
    "why_it_governs": "Holistic — trace what the board's data exposure affects (privacy).",
    "how_this_build_will_embody_it": "The aggregate exposes only totals; per-session detail never leaves the rep-private ledger." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T12:21:23+08:00",
    "why_it_governs": "Layer-2 effectivity — the board must actually render sane numbers, proven.",
    "how_this_build_will_embody_it": "Previewed the aggregate on live seed + rendered the UI to a PNG that reads correctly." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-03T12:21:24+08:00",
    "why_it_governs": "Reuse the repo's shell/nav/theme, don't template a new UI system.",
    "how_this_build_will_embody_it": "Used SalesCoachShell nav + the app's theme tokens; the page is a thin content component under the layout." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "162-198", "read_at": "2026-09-03T12:21:25+08:00",
    "why_it_governs": "A user-SPECIFIED experience (the competitive interface) is layer-2, not waivable polish.",
    "how_this_build_will_embody_it": "Built the competitive board the founder specified AND visually verified it before calling it done." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "244-270", "read_at": "2026-09-03T12:21:26+08:00",
    "why_it_governs": "Ground-up audit (carried from Phase 0 in range).",
    "how_this_build_will_embody_it": "Rests on the Phase-0 inspection that set the privacy + reuse design." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T12:21:27+08:00",
    "why_it_governs": "Single-source — the total is SUM(ledger) via the function, not a cached counter.",
    "how_this_build_will_embody_it": "The RPC sums the ledger; no denormalized total column exists to drift." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T12:21:28+08:00",
    "why_it_governs": "Honesty — real numbers + an honest empty state.",
    "how_this_build_will_embody_it": "The board shows a real empty state; no fabricated ranks; agents with no points are absent, not zeroed in." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T12:21:29+08:00",
    "why_it_governs": "Verify (incl. visually) before claiming done.",
    "how_this_build_will_embody_it": "Rendered + read the board; ran the route tests + typecheck before reporting Phase 5." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T12:21:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Reused the shell, honored privacy in the data path, verified visually, kept presentation restrained." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-09-03T12:21:31+08:00",
    "why_it_governs": "Surfacing behavior data to a leader — the privacy model is the structural defense.",
    "how_this_build_will_embody_it": "The board exposes only aggregates; per-session detail stays rep-private via the ledger RLS." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T12:21:32+08:00",
    "why_it_governs": "Methodology in the working tree, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T12:21:33+08:00",
    "why_it_governs": "Citations without session-reading are undetected violations.",
    "how_this_build_will_embody_it": "Manifest + commit trailer pair each cite with a read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T12:21:34+08:00",
    "why_it_governs": "Gate the lesson — the route logic is test-pinned.",
    "how_this_build_will_embody_it": "The route's period-validation + meRank are covered by tests, not left to prose." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-03T12:21:35+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes db:apply, the aggregate preview, the route tests, and the render." }
]
```
