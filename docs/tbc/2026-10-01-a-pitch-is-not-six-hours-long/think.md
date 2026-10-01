---
started_at: 2026-10-01T04:59:00Z
trigger: Closing the short-audio question, recent sales sessions showed 6-7 hour spans between started_at and ended_at; the pitch scorer's duration fallback subtracts them, and 10 unscored sessions in production would be stored as pitches over 30 minutes long.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a pitch is not six hours long

## The problem, from the record

- `auto-close-stale-cron` ends any session still active after 6 hours by setting status='ended'; the 0070
  trigger stamps `ended_at = now()`. So an abandoned session ends 6+ hours after it started.
- `scoreSession.ts` `sessionDurationS` used the audio length, else `ended_at - started_at` with no cap.
- `conversationDurationSeconds` already holds the shared rule, with a 4-hour cap that returns unknown
  (2026-08-29, after a "32051.9 min" average). The Sessions list, After-Pitch and the KPI average use it.
- Production, read-only: 0 stored pitch durations over 30 minutes yet; 10 unscored sessions would get one.
  `RecordingsTab.tsx:221` prints the stored value as a clock.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-01T05:02:58Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The cause came from the record: recent sessions show 6-7 hour spans; auto-close-stale-cron sets status='ended' and the 0070 trigger stamps ended_at = now(); the scorer's fallback subtracted the two."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-01T05:02:58Z",
    "why_it_governs": "Methodology in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "Both documents are in the tree; this manifest's reads were printed after the build started, lines cut at 400 characters."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-01T05:02:58Z",
    "why_it_governs": "Four layers in order; layer 2 is whether a manager reads a true length on the Recordings tab.",
    "how_this_build_will_embody_it": "L2: an auto-closed pitch now shows no length rather than '6:15:53'. L3: the Sessions list, After-Pitch and KPIs already used the shared rule, so all surfaces now agree. L1: one rule, one place."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-01T05:02:58Z",
    "why_it_governs": "Audit as you work; surface adjacent problems.",
    "how_this_build_will_embody_it": "Found while closing an unrelated audio question; the sweep found no other copy of the subtraction (INVARIANT 31 passes on the tree)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-10-01T05:02:58Z",
    "why_it_governs": "A decision has one source; a re-derived copy drifts.",
    "how_this_build_will_embody_it": "sessionDurationS was a re-derivation of conversationDurationSeconds that had dropped the 4-hour cap term. It now consumes the shared rule."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-10-01T05:02:58Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "No founder decision: the shared rule and its cap were already decided (2026-08-29); this makes the scorer follow it."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-01T05:03:02Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Printed and read at the recorded time, lines cut at 400 characters."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-10-01T05:03:02Z",
    "why_it_governs": "Citation needs an in-session read.",
    "how_this_build_will_embody_it": "Reads re-done after this build began; earlier reads were not reused for it."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-01T05:03:02Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "INVARIANT 31 fails on any ended-minus-started subtraction outside conversationDuration.ts; it flags the old scorer at scoreSession.ts:290."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-01T05:03:02Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check by name, with its exit code, in check.md."
  }
]
```
