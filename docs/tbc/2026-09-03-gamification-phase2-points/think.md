---
started_at: 2026-09-03T11:35:00+08:00
---

# THINK — Gamification Phase 2 (points mapping + ledger-write orchestrator)

## Why
Phase 1 shipped the ledger. Phase 2 turns an already-scored session into banked points. Because the founder chose
REUSE (docs/gamification/DECISIONS.md), this is NOT the plan's LLM judge — it is a pure mapping from the existing
after-pitch dimension scores plus a small idempotent orchestrator. Far smaller than the plan's Phase 2 assumed.

## Understanding (single-source reuse — CLAUDE.md 2.2)
The after-pitch summary already holds ScoreCategory[] (0–10 per dimension, with citations). Points =
round(mean of the counted dimensions × 10) → 0–100. No second judge, no re-transcription, no divergent score.

## The build
- `src/lib/coach/gamification/points.ts` — PURE. `computeSessionPoints(categories)` → { points, band, dimensions }
  or null (no counted dimension → bank nothing, never a fabricated 0). `bandFor(points)` classifies via the
  contiguous BANDS. Rounds half-up (stated in a comment).
- `src/lib/coach/gamification/bankPoints.ts` — the ONLY DB side effect. `bankSessionPoints(sessionId)` reads the
  session's after-pitch scores (service-role), maps them, inserts ONE session_score ledger row. IDEMPOTENT: a
  unique violation (23505) on the Phase-1 index returns already_banked — no second row, no double points. A real
  (non-23505) error propagates (never swallowed). Missing summary / no scored dimension → honest reason, banks
  nothing.

## Verification (layer-2, A38)
17 tests across the gamification suite (rubric config + points mapping + orchestrator): normalization, half-up
rounding, only-counted-dimensions, empty→null, band boundaries, banks-once, idempotent already_banked, honest
empties, and a real-error-propagates test. Typecheck clean.

## Out of scope (per the plan)
No trigger/wiring to session-end (Phase 3), no notifications (Phase 4), no UI (Phase 5), no backfill (D14).

## Session-read manifest (A22 — read_at ≥ started_at 11:35; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T11:36:47+08:00",
    "why_it_governs": "Understanding precedes solving — the mapping reuses the real scorer output shape, read this session.",
    "how_this_build_will_embody_it": "computeSessionPoints consumes the actual ScoreCategory[] the after-pitch produces." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T11:36:48+08:00",
    "why_it_governs": "The methodology defining understanding must be in the working tree and read this session before action.",
    "how_this_build_will_embody_it": "CLAUDE.md is in context and the cited axioms were re-opened this session before building." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T11:36:48+08:00",
    "why_it_governs": "Retrospective identification from the record — carried from the Phase-1 commit in range.",
    "how_this_build_will_embody_it": "The mapping reuses the real, inspected scorer output rather than an assumed shape." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "162-198", "read_at": "2026-09-03T11:36:48+08:00",
    "why_it_governs": "A user-specified experience is layer-2 — carried from the meeting-review PDF + Phase-1 commits in range.",
    "how_this_build_will_embody_it": "Not exercised here (backend mapping); cited because same-range commits built founder-specified surfaces." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "244-270", "read_at": "2026-09-03T11:36:48+08:00",
    "why_it_governs": "Ground-up audit — carried from the Phase-0/Phase-1 commits in range.",
    "how_this_build_will_embody_it": "Phase 2 rests on the Phase-0 inspection that grounded the whole design." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-09-03T11:36:48+08:00",
    "why_it_governs": "Surfacing behavior data to a leader — the privacy model is the structural defense — carried from Phase 1 in range.",
    "how_this_build_will_embody_it": "The points detail stays owner+manager readable; Phase 2 writes no peer-visible per-session data." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T11:36:49+08:00",
    "why_it_governs": "Holistic solutioning — trace what a change affects before committing (carried from Phase 1 in range).",
    "how_this_build_will_embody_it": "Phase 2 reads existing scores + writes only the Phase-1 ledger; ripple traced in build.md." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T11:36:49+08:00",
    "why_it_governs": "Layer-2 effectivity — the mapping + idempotency must actually work, proven by tests.",
    "how_this_build_will_embody_it": "17 tests incl. banks-once + already_banked + real-error-propagates." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-03T11:36:50+08:00",
    "why_it_governs": "Reuse the repo's data (the existing scores), don't re-derive.",
    "how_this_build_will_embody_it": "Points derive from after_pitch_summaries.payload.scores; no new scoring." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T11:36:51+08:00",
    "why_it_governs": "Single-source — the score has one authority (the after-pitch); points consume it.",
    "how_this_build_will_embody_it": "No second judge; the ledger banks a derived total from the one score." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T11:36:52+08:00",
    "why_it_governs": "Honesty — never a fabricated number.",
    "how_this_build_will_embody_it": "No scored dimension → null → bank nothing; a real error propagates, not a fake 0." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T11:36:53+08:00",
    "why_it_governs": "Verify before claiming done.",
    "how_this_build_will_embody_it": "Ran the suite + typecheck before reporting Phase 2 complete." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T11:36:54+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Reused the existing data, kept pure/orchestrator split, tested idempotency + honesty." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T11:36:55+08:00",
    "why_it_governs": "Methodology that governs the build must live in the working tree, not be cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session before building Phase 2." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T11:36:56+08:00",
    "why_it_governs": "Constitutional citations without session-reading are violations operating undetected.",
    "how_this_build_will_embody_it": "The manifest + commit trailer pair each cited section with an in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T11:36:57+08:00",
    "why_it_governs": "A lesson in prose recurs — encode the invariant in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Idempotency is DB-enforced (the Phase-1 unique index) + test-pinned, not left to prose." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-03T11:36:58+08:00",
    "why_it_governs": "'Verified' names the command + evidence.", "how_this_build_will_embody_it": "check.md pastes the vitest + typecheck output." }
]
```
