---
started_at: 2026-08-28T11:50:00+08:00
---

# THINK — dedup after_pitch_summaries to the latest per session (backfill prerequisite + accuracy fix)

## Why (discovered while scoping the objection backfill)
The founder chose to backfill objection history (re-generate after-pitch so the new tally populates). Investigating
it (§1.2 — read the table's design) surfaced a latent bug: `after_pitch_summaries` is APPEND-ONLY (a DB rule blocks
UPDATE/DELETE; migration 0080 says "the latest by created_at is the current summary"), so a session whose
after-pitch was re-generated (viewed more than once — which happens on every Pitch view) has MULTIPLE rows. But the
KPI reads (/me + /team) read ALL rows and DON'T take the latest per session — so re-generated sessions are already
DOUBLE-COUNTED in every payload-derived metric (Layer-3 quality/talk/skill/consistency sample sizes; the me route's
comment even wrongly asserts "ONE row per session"). A mass backfill would append a row to EVERY session and double
every Layer-3 sample. So the dedup MUST land first — and it fixes a real existing inaccuracy (directly the founder's
"numbers are inaccurate" concern).

## The build (§1.5 — one shared helper, both readers)
- `compute.ts latestSummaryPerSession(rows)` — pure: collapse to the latest row per session by created_at (the
  table's "current summary"); on equal/absent created_at the last-seen wins (still one per session).
- `me/route.ts` + `team/route.ts` — select `created_at`, run `latestSummaryPerSession` on the paged
  after_pitch_summaries BEFORE any payload metric (layer3 / objections / uptake / quality) reads them.

## Why it's correct + safe
Only the payload-derived reads change; they now count each call once, matching the table's documented intent. The
recommendation-uptake metric already deduped internally (belt-and-suspenders now). No schema change; the fix is a
read-side collapse. This unblocks the backfill: a re-generated (tallied) summary becomes the latest, and the reads
take it.

## Session-read manifest (A22 — read_at ≥ started_at 11:50:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T11:51:00+08:00",
    "why_it_governs": "Understand the table's append-only design before backfilling — don't corrupt Layer-3.",
    "how_this_build_will_embody_it": "Read migration 0080; the dedup matches 'latest by created_at is current'." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T11:51:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-57", "read_at": "2026-08-28T11:51:08+08:00",
    "why_it_governs": "Retrospective — the bug is visible in the record (append-only rule + multi-row reality), not theorized.",
    "how_this_build_will_embody_it": "Diagnosed from the migration + the probe's 15 dup rows; fixed the read to match the design." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T11:51:10+08:00",
    "why_it_governs": "Holistic — a backfill that ignores this would silently break Layer-3 sample sizes.",
    "how_this_build_will_embody_it": "One shared dedup helper in both readers; the backfill is safe on top of it." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T11:51:15+08:00",
    "why_it_governs": "Layer 2 — the metric must be CORRECT (count each call once), not just present.",
    "how_this_build_will_embody_it": "Dedup makes Layer-3 sample sizes accurate; tests lock the collapse." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T11:51:18+08:00",
    "why_it_governs": "THINK-first — the backfill request prompted auditing the read, catching the double-count.",
    "how_this_build_will_embody_it": "Audited the payload reads before appending; found + fixed the latent bug." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T11:51:20+08:00",
    "why_it_governs": "Honesty — an inflated sample size overstates the evidence behind a number.",
    "how_this_build_will_embody_it": "Each call counts once; the sample size reflects real distinct calls." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T11:51:25+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from the record, one shared fix, both readers, tested." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T11:51:30+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T11:51:35+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T11:51:40+08:00",
    "why_it_governs": "Gate the lesson — the dedup must be tested so a regression to double-count fails.",
    "how_this_build_will_embody_it": "Tests assert latest-by-created_at wins + one-per-session with no created_at." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T11:51:45+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code." }
]
```
