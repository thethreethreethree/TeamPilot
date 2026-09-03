---
started_at: 2026-09-03T13:00:00+08:00
---

# THINK — Gamification Phase 6 (the calibration tool)

## Why (founder chose Phase 6; it is the honesty gate the whole feature rests on)
The founder picked the calibration tool next. It answers the one question the leaderboard cannot answer for itself:
does the AI score actually measure what it claims, BEFORE anyone's rank rests on it? This is the constitutional
spine of the whole feature — §3.5 forbids "grading your own homework": a leaderboard driven by an unvalidated score
is exactly that. Phase 6 makes the score falsifiable against a human before it drives competition.

## Understanding (blind-then-reveal, anonymized, manager-only)
The method is a control: a manager hand-scores a real transcript BLIND — without seeing the model's scores — then
we reveal the model's scores and measure the per-dimension gap. Agreement is evidence the score is trustworthy;
persistent disagreement on a dimension flags it for a look before it counts.
- ANONYMIZED (A18): the manager calibrates the SCORER, never a named rep. The transcript is rendered speaker-role
  only (REP / PROSPECT), never the rep's name — a manager must not be able to read "rep X scored low" off this tool.
- JUDGED dimensions only: opener, objection, tone, close, next_step. talk_ratio and question_rate are computed
  deterministically (not human judgement), so they are excluded — calibrating a computed number is meaningless.
- Manager-only: the same predicate the coaching RLS uses (company admin OR sales_coach_role='admin').

## The build
- Migration 0244: `gamification_calibration` — append-only human blind scores (company + session + scorer + jsonb
  scores), unique (scorer_id, session_id), manager-read RLS; writes go through the service-role route after an
  auth+manager check (no client write policy).
- `src/lib/coach/gamification/calibration.ts` — pure `computeCalibration`: per-dimension meanAbsDiff, trustworthy
  (<= 1.5), worst disagreements (top 5), overallTrustworthy (null when no data — never a fabricated verdict).
- Route `/api/coach/gamification/calibration` — GET (report + the next anonymized transcript, model withheld),
  POST (store blind score, then reveal the model's judged scores). Service-role, manager-gated.
- UI `CalibrationTool.tsx` + `/dashboard/sales-coach/calibration` page + a "Score Calibration" nav item (Scale,
  managerOnly). Read transcript → score five sliders blind → submit → you-vs-AI reveal + running report.

## Verification (A38, §5)
Pure logic: 6 tests (perfect agreement, threshold flag, boundary <=, both-sides-only counting, worst-first,
empty→null). Route: 4 tests (403 unauth, 403 non-manager, GET anonymization + report, POST reveal). Typecheck
clean; nav test 16. UI rendered to a PNG and read (report banner, anonymized transcript, sliders, submit).
The migration is WRITTEN but NOT YET APPLIED (the network is down — Supabase pooler unreachable this session);
db:apply is a named pending step, surfaced honestly, not claimed as done.

## Out of scope
The actual calibration RUN (the founder hand-scoring ~20 transcripts) — that is operating the tool, not building it.
Auto-suppressing a dimension from the leaderboard when calibration fails (a future gate once real data exists).

## Session-read manifest (A22 — read_at >= started_at 13:00; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T13:09:00+08:00",
    "why_it_governs": "Understanding precedes solving — the blind-then-reveal method was designed from what calibration MEANS (a control against grading your own homework), not assumed from the word 'calibration'.",
    "how_this_build_will_embody_it": "The tool measures the model against an independent human blind score before the score drives any rank." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T13:09:10+08:00",
    "why_it_governs": "The methodology defining understanding must be in the tree and read this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "CLAUDE.md is in context; the cited axioms were re-opened this session (timestamps below)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T13:09:12+08:00",
    "why_it_governs": "Retrospective identification — matched the existing gamification route/RLS/auth patterns from the record rather than inventing a new shape.",
    "how_this_build_will_embody_it": "The route mirrors the sibling leaderboard/my-points routes; the migration mirrors 0242/0243 RLS; the nav mirrors the Scoreboard item." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T13:09:14+08:00",
    "why_it_governs": "Holistic — trace what the calibration data exposure affects (a manager could otherwise read named rep performance off it).",
    "how_this_build_will_embody_it": "The transcript is anonymized to speaker-role; the store has manager-read RLS + no client write; the ledger is untouched." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T13:09:20+08:00",
    "why_it_governs": "Layer-2 effectivity — the tool must actually compute a correct human-vs-model gap and anonymize, proven end-to-end.",
    "how_this_build_will_embody_it": "Pure-logic tests + route tests (incl. the anonymization assertion) + a rendered UI; the one unmet precondition (db:apply) is surfaced, not hidden." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-03T13:09:30+08:00",
    "why_it_governs": "Reuse the repo's shell/nav/theme/auth patterns, don't template a new system.",
    "how_this_build_will_embody_it": "Used SalesCoachShell nav (managerOnly), the app theme tokens, getCurrentAuthContext + createAdminClient, and readBody validation like the sibling gamification routes." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-198", "read_at": "2026-09-03T13:09:34+08:00",
    "why_it_governs": "External-config completeness — the feature depends on migration 0244 existing in the live DB, which the repo cannot hold.",
    "how_this_build_will_embody_it": "The unapplied migration is flagged as a BLOCKING db:apply step in check.md + closure residual, not silently assumed present." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-235", "read_at": "2026-09-03T13:09:36+08:00",
    "why_it_governs": "A user-specified experience is layer-2 — but here the founder specified a TOOL, not a look, so the honest layer-2 is a working, verified utility.",
    "how_this_build_will_embody_it": "The tool is functionally complete + verified (tests + render); the design is clean/legible but not over-invested, matching the ask." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-270", "read_at": "2026-09-03T13:09:38+08:00",
    "why_it_governs": "Ground-up audit — the privacy + reuse design rests on the Phase-0 inspection of the gamification plan.",
    "how_this_build_will_embody_it": "Carries the Phase-0 findings (reuse scores, gamify-within-privacy) into the calibration data path." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T13:09:42+08:00",
    "why_it_governs": "Single-source — the model's scores come from the ONE authority (after_pitch payload), not a re-judged copy.",
    "how_this_build_will_embody_it": "modelScores reads the existing judged dimensions from after_pitch_summaries; calibration never re-runs the judge." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-09-03T13:09:44+08:00",
    "why_it_governs": "Honesty / no fabricated verdict — a trust verdict with no data would be a claimed understanding the system cannot have.",
    "how_this_build_will_embody_it": "overallTrustworthy is null until real pairs exist; the tool measures trust, it does not yet ACT on it (residual GAM-R9)." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-392", "read_at": "2026-09-03T13:09:46+08:00",
    "why_it_governs": "'Measuring agreement instead of consequence is grading your own homework' — an unvalidated score driving a leaderboard is precisely that. Phase 6 is the structural answer.",
    "how_this_build_will_embody_it": "Calibration makes the score falsifiable against an independent human before it counts; the report flags any dimension that disagrees." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-430", "read_at": "2026-09-03T13:09:48+08:00",
    "why_it_governs": "Verify before claiming done; distrust the fast-confident answer.",
    "how_this_build_will_embody_it": "Ran the tests + typecheck + a visual render, and refused to claim db:apply ran when it did not." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T13:09:50+08:00",
    "why_it_governs": "Quick-decision checklist (privacy, reuse, verify visually, honest unmet precondition).",
    "how_this_build_will_embody_it": "Anonymized data path (A18), reused shell + auth, rendered the UI, and flagged db:apply as pending rather than claiming it." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-450", "read_at": "2026-09-03T13:08:00+08:00",
    "why_it_governs": "Surfacing human-behavior data to a leader — the label/anonymization IS the structural defense against a manager using the tool to punish a named rep.",
    "how_this_build_will_embody_it": "The transcript is rendered speaker-role only; the rep's name never leaves the server into the calibration UI; the manager scores the SCORER, not a person." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-03T13:08:10+08:00",
    "why_it_governs": "Methodology in the working tree, read in session — not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms (A18/A22/A30/A38) this session before citing them." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-640", "read_at": "2026-09-03T13:08:20+08:00",
    "why_it_governs": "A citation without a session-read is an undetected violation; the pre-closure session-read manifest closes the speed gap.",
    "how_this_build_will_embody_it": "This manifest pairs every cited asset with an in-session read_at; the commit carries the Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-03T13:08:30+08:00",
    "why_it_governs": "A lesson in prose returns; a fix is complete only when the class is encoded in a GATE that fails without the author.",
    "how_this_build_will_embody_it": "computeCalibration's rules (threshold, both-sides counting, empty->null, worst-first) are pinned by tests; the manager gate + anonymization are pinned by route tests." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-03T13:08:40+08:00",
    "why_it_governs": "'Verified' names the COMMAND and evidence; do not report a recipe you didn't run.",
    "how_this_build_will_embody_it": "check.md names each command + its output, and explicitly marks db:apply as PENDING (network down) rather than claiming it ran." }
]
```
