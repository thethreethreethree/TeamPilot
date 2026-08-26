---
started_at: 2026-08-26T09:20:00+08:00
---

# THINK — P1: "Generate missing won't generate" → content-aware backfill (exclude empty captures)

## Diagnosis FIRST, from code + data (not a guess — the lesson from earlier today)
Founder (Moses, P1, 5h): Coach Assessment "Generate missing" reports *"Generated 0, 4 too thin/failed. 86 still
missing"* and won't generate. Traced the path: button → POST `/backfill-dissects` → `runDissectBackfill` → for each
un-dissected ended/reviewed session, run `generateSessionArtifacts`; `dissect.hasSignal===false` → "thin/failed". A
thin session short-circuits before the LLM (§3.4 no-fabrication). So "thin/failed" = the transcript has no content.

Then I read the DATA (`coaching_transcript_segments` counts for the missing sessions), not assumed:
- Company 28203036: 136 ended/reviewed, 29 dissected, **107 missing → 25 RECOVERABLE (have a transcript) + 82 EMPTY (0 segments)**.
- Company c3e7f389: 135 / 32 dissected / **103 missing → 41 recoverable + 62 empty**.
Confirmed `getSessionTranscriptAdmin` reads the same `coaching_transcript_segments`, so 0 segments = genuinely no transcript.

## Root cause
~80% of "missing" sessions are EMPTY captures — the iOS empty-capture class (fixed today in 34a8ab71). An empty
session has no content to assess, yet the backfill counted it as "missing" and fed it to the batch. The batch
processes newest-first, 4/click; recent sessions are mostly empty, so every click filled with empties → generated 0
→ the manager saw "0 generated / N still missing" forever and concluded it was broken. The real transcripts (25/41)
were buried behind ~100 empty sessions.

## The fix (§3.4 honest, §1.5.1 layer-2 make-it-actually-work)
A session with ZERO transcript segments is NOT a recoverable "missing dissect" — it is an empty capture. Split them
out: only sessions WITH a transcript are "missing" (recoverable + batched); empty ones are reported as `noContent`.
Result: "remaining" reflects the TRUE recoverable count (25/41), each click now GENERATES up to 4 real assessments
(progress, drains to 0), and the empties are surfaced honestly ("N sessions had no audio captured, nothing to
assess") instead of masquerading as an un-generatable backlog. The content check is LIVE each run, so a later
re-transcription auto-recovers a session.

## Ripple (holistic — §6 item 5)
- `runDissectBackfill` adds one bounded content query (`fetchAllPaged` over `coaching_transcript_segments` for the
  missing ids — cap-safe per the 1000-row-truncation discipline) + a `noContent` field. Shared by BOTH callers (manual
  button + all-company cron) — the cron benefits identically (stops burning function-time re-checking empty sessions).
- Result type gains `noContent` (additive — the cron reads only what it needs; typecheck confirms).
- Page message surfaces `noContent`. No schema/route-auth change.

## A26 bearing
This is the DOWNSTREAM of the iOS empty-capture class (34a8ab71): capture failure → empty transcript → un-assessable
session → polluted backfill. The capture fix stops NEW empties; this makes the backfill honest about the EXISTING
ones (which can't be retroactively recovered — there is no audio).

## A30 gate
Tests: an empty (0-segment) session is excluded from `missing` and counted in `noContent`, with NO LLM call on it; a
batch of all-empty sessions returns generated 0 / remaining 0 / noContent N (not a frozen "remaining").

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 09:20:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-26T09:31:05+08:00",
    "why_it_governs": "Understanding earned before solving.",
    "how_this_build_will_embody_it": "Diagnosed from the transcript-segment DATA (25/82, 41/62 splits), not assumed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-26T09:31:07+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-92", "read_at": "2026-08-26T09:31:09+08:00",
    "why_it_governs": "Layer 2 — does 'Generate missing' actually deliver the intended result when the manager clicks it? It didn't (0 forever).",
    "how_this_build_will_embody_it": "Each click now generates the recoverable sessions + honestly explains the empties — it works end-to-end." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "144-149", "read_at": "2026-08-26T09:31:11+08:00",
    "why_it_governs": "Think from data, then fix.",
    "how_this_build_will_embody_it": "The segment-count data named the cause (empty-capture pollution); the fix is content-aware." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-26T09:31:13+08:00",
    "why_it_governs": "Honesty is the moat — an empty session must be surfaced as 'no content', never fabricated into an assessment or hidden as a stuck backlog.",
    "how_this_build_will_embody_it": "Empty sessions are reported as noContent honestly; no LLM fabricates a review from nothing." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-08-26T09:31:15+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood from data, traced ripple (shared cron caller, cap-safe query), gated with tests." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-457", "read_at": "2026-08-26T09:31:17+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-596", "read_at": "2026-08-26T09:31:19+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-693", "read_at": "2026-08-26T09:31:21+08:00",
    "why_it_governs": "This symptom is the downstream of the iOS empty-capture class.",
    "how_this_build_will_embody_it": "Names the connection (capture fix stops new empties; this makes the backfill honest about existing ones)." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-26T09:31:23+08:00",
    "why_it_governs": "Encode the fix in a gate.",
    "how_this_build_will_embody_it": "Tests pin the empty-session exclusion + noContent + no-LLM-on-empty behavior." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-26T09:31:25+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
