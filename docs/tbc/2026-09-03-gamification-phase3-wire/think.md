---
started_at: 2026-09-03T11:50:00+08:00
---

# THINK — Gamification Phase 3 (wire banking to session-end + backfill the existing scores)

## Why
Founder chose "wire it live + backfill" after the dry-run showed sane points over 272 real sessions (median 50,
well-spread bands, ~15% strong). Phase 3 makes points bank automatically and seeds the board from day one.

## Understanding (the trigger point)
Points must bank when the SCORE exists, not merely when the session ends. The after-pitch summary IS the score
(reuse decision), generated + stored in ONE place — generateAndStoreAfterPitch — run by BOTH the on-view route AND
the recovery backfill (the A16 single-sequence). So the ONE correct hook is right after saveAfterPitchSummary:
both entry points then bank for free, and a session never cleanly Stopped still banks when its review generates.

## The build
- Wire: `src/lib/coach/v5/generateAndStoreAfterPitch.ts` calls `bankSessionPoints(sessionId)` after the summary is
  saved. Best-effort + idempotent + NO LLM (a fast DB read+insert), so it runs inline and NEVER throws into the
  after-pitch flow — a points failure must not break the review a rep is waiting for.
- Backfill: `bankSessionPoints`'s companion `backfillSessionPoints()` (banks every summarized session lacking a
  ledger row) + a one-time seed script. Seeded 131 ledger rows live (9 agents on the board, top total 3604).
- Drift-guard tests: the wire fires on a signal summary, does NOT fire on a thin one, and a bank failure never
  sinks the save.

## Verification (layer-2, A38)
22 tests (after-pitch wire suite + the gamification suite): wire-called / not-called / best-effort, plus the
Phase-2 mapping + idempotency. Typecheck clean. Live seed applied + verified (ledger 131 rows, board populated).

## Out of scope
Notifications (Phase 4), UI/leaderboard (Phase 5), calibration (Phase 6).

## Session-read manifest (A22 — read_at ≥ started_at 11:50; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T11:52:10+08:00",
    "why_it_governs": "Understanding precedes solving — hooked the ONE real generation sequence, not a guessed trigger.",
    "how_this_build_will_embody_it": "bankSessionPoints fires from generateAndStoreAfterPitch, the single scored-artifact path." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T11:52:11+08:00",
    "why_it_governs": "The methodology defining understanding must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; cited axioms re-opened this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T11:52:12+08:00",
    "why_it_governs": "Retrospective identification — the trigger point was found from the real code path, not assumed.",
    "how_this_build_will_embody_it": "Read generateAndStoreAfterPitch to place the hook where both callers converge." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T11:52:13+08:00",
    "why_it_governs": "Holistic — trace what the wire affects before committing.",
    "how_this_build_will_embody_it": "The wire is best-effort so it cannot break the after-pitch flow; ripple traced in build.md." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T11:52:14+08:00",
    "why_it_governs": "Layer-2 effectivity — points must actually bank, proven live + by tests.",
    "how_this_build_will_embody_it": "Seeded 131 rows live + drift-guard tests that the wire fires." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-03T11:52:15+08:00",
    "why_it_governs": "Reuse the one generation sequence (A16), don't add a parallel trigger.",
    "how_this_build_will_embody_it": "Hooked the shared generateAndStoreAfterPitch, so both callers bank from one definition." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "162-198", "read_at": "2026-09-03T11:52:16+08:00",
    "why_it_governs": "User-specified experience is layer-2 (carried from same-range commits).",
    "how_this_build_will_embody_it": "Not exercised here (backend wire); cited for range coverage." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "244-270", "read_at": "2026-09-03T11:52:17+08:00",
    "why_it_governs": "Ground-up audit (carried from Phase 0 in range).",
    "how_this_build_will_embody_it": "Rests on the Phase-0 inspection that placed the wire correctly." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T11:52:18+08:00",
    "why_it_governs": "Single-source — one trigger, not a second scoring path.",
    "how_this_build_will_embody_it": "Points bank from the existing after-pitch score at its one generation site." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T11:52:19+08:00",
    "why_it_governs": "Honesty — never fabricate; a thin session banks nothing.",
    "how_this_build_will_embody_it": "No summary/no score → not banked; the seed skips not-scoreable sessions." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T11:52:20+08:00",
    "why_it_governs": "Verify before claiming done.",
    "how_this_build_will_embody_it": "Ran the suite + typecheck + a live seed verification before reporting Phase 3 complete." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T11:52:21+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Hooked the shared path, kept best-effort, seeded idempotently, drift-guarded the wire." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-09-03T11:52:22+08:00",
    "why_it_governs": "Leader-visibility privacy model (carried from Phase 1 in range).",
    "how_this_build_will_embody_it": "The wire writes only the owner+manager-readable ledger; no peer-visible detail." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T11:52:23+08:00",
    "why_it_governs": "Methodology in the working tree, not cited from cache.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T11:52:24+08:00",
    "why_it_governs": "Citations without session-reading are undetected violations.",
    "how_this_build_will_embody_it": "Manifest + commit trailer pair each cite with a read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T11:52:25+08:00",
    "why_it_governs": "Gate the lesson — the wire must not silently regress.",
    "how_this_build_will_embody_it": "A drift-guard test asserts bankSessionPoints fires from generateAndStoreAfterPitch." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-03T11:52:26+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes the 22-test run, typecheck, and the live seed verification." }
]
```
