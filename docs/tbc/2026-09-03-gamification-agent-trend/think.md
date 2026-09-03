---
started_at: 2026-09-03T12:38:00+08:00
---

# THINK — Gamification: the agent's own points-trend view (Phase 5 part 3)

## Why
Phase 5 shipped the team board; this completes the agent-facing side: a rep sees their OWN points progress + a
trend + their recent sessions linking to the (private) after-pitch detail. Per D13/D15 the after-pitch already IS
the per-session breakdown, so the new piece is just a points trend + summary, not a second detail view.

## Understanding (privacy)
This is the rep's PRIVATE data (their own ledger), distinct from the public board. The route reads the caller's own
rows via owner-RLS (agent_id = auth.uid()); nothing exposes another rep's points here.

## The build
- `/api/coach/gamification/my-points` — the caller's own session_score ledger rows (points + band + session link),
  oldest→newest, + total/avg computed by the app (SUM the ledger, not a cached counter).
- `MyProgress.tsx` — summary (total/avg/sessions) + a restrained points-per-session sparkline (one accent line,
  faint 0–100 frame, last point marked — no gradients/legends/gridlines) + recent sessions linking to their
  after-pitch. Rendered above the board on the scoreboard page.

## Verification (layer-2 / AMD-012, A38)
3 route tests (401, total/avg/band shape, empty→zeros); typecheck clean; the progress card RENDERED to a PNG and
read (clean trend + summary + session list).

## Session-read manifest (A22 — read_at ≥ started_at 12:38; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T12:39:43+08:00",
    "why_it_governs": "Understanding precedes solving — reused the after-pitch as the detail view rather than rebuilding it.",
    "how_this_build_will_embody_it": "Each trend row links to the existing after-pitch; only the trend/summary is new." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T12:39:44+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; axioms re-opened this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T12:39:44+08:00",
    "why_it_governs": "Retrospective identification (carried in range).",
    "how_this_build_will_embody_it": "Reused the real after-pitch detail path rather than assuming a new one." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T12:39:44+08:00",
    "why_it_governs": "Holistic — trace what the view exposes (privacy).",
    "how_this_build_will_embody_it": "Owner-RLS read; the view shows only the caller's own points." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T12:39:45+08:00",
    "why_it_governs": "Layer-2 effectivity — the trend must render sane, proven.",
    "how_this_build_will_embody_it": "Route tests + a rendered-PNG visual check." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-03T12:39:45+08:00",
    "why_it_governs": "Reuse the repo's patterns (the after-pitch as the detail view; the ledger as the source).",
    "how_this_build_will_embody_it": "The trend links to the existing after-pitch; only the summary/sparkline is new." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "244-270", "read_at": "2026-09-03T12:39:45+08:00",
    "why_it_governs": "Ground-up audit (carried from Phase 0 in range).",
    "how_this_build_will_embody_it": "Rests on the Phase-0 inspection." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "162-198", "read_at": "2026-09-03T12:39:46+08:00",
    "why_it_governs": "A user-specified experience (the competitive/progress interface) is layer-2.",
    "how_this_build_will_embody_it": "Built the progress view + verified it visually before calling it done." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T12:39:47+08:00",
    "why_it_governs": "Single-source — the total is SUM(ledger), not a cached number.",
    "how_this_build_will_embody_it": "The route sums the caller's ledger rows; no denormalized total." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T12:39:48+08:00",
    "why_it_governs": "Honesty — empty history is zeros, not a fabricated trend.",
    "how_this_build_will_embody_it": "No points → the component renders nothing; the route returns zeros." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T12:39:49+08:00",
    "why_it_governs": "Verify before claiming done.",
    "how_this_build_will_embody_it": "Ran the tests + typecheck + a visual render before reporting." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T12:39:50+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Reused the after-pitch detail, kept the dataviz restrained, verified visually." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-09-03T12:39:51+08:00",
    "why_it_governs": "Leader-visibility privacy.",
    "how_this_build_will_embody_it": "This view is the rep's OWN private data (owner-RLS), never another rep's." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T12:39:52+08:00",
    "why_it_governs": "Methodology that governs the build must live in the tree, not be cited from cache.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session before building." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T12:39:52+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "Manifest + trailer pair each cite with a read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T12:39:52+08:00",
    "why_it_governs": "A lesson in prose recurs — encode it in a gate; the route logic is test-pinned.",
    "how_this_build_will_embody_it": "The route's total/avg/empty behavior is covered by tests, not prose." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-03T12:39:53+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes the tests + typecheck + the render." }
]
```
