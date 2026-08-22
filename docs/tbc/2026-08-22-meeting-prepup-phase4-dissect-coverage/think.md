---
started_at: 2026-08-22T14:00:00+08:00
---

# THINK — Prep-up Phase 4: Dissect agenda coverage (Team-Sync)

The last Prep-up phase: the post-meeting Dissect now measures the meeting against its OWN Prep-up agenda — did it
hit the GOAL, and which must-discuss TOPICS were covered vs missed. §3.5 is load-bearing: this measures a
CONSEQUENCE (did the meeting produce its intended result), never whether the coach's cues were followed
(agreement is forbidden).

## Design
- The dissect route loads the session's prep (`getMeetingPrepBySession` + `getPrepDocContext`) and passes a
  `MeetingAgenda` to `generateAndStoreMeetingDissect` → `generateMeetingDissect`.
- The dissect prompt renders the goal + must-discuss topics (id + text) and asks for an `agenda` block:
  `goalAttained` (yes|partial|no) + `note` + `covered` (topic ids discussed over the FULL diarized transcript).
- Coverage is RE-ASSESSED at dissect time over the full transcript (more authoritative than the live
  window-accumulated coverage) — `parseAgendaJudgment` extracts it (separate from the unchanged
  `parseMeetingDissect`), and `generateMeetingDissect` maps the covered ids onto the agenda's topic texts →
  `DissectAgenda {goal, goalAttained, note, topics:[{text,covered}]}`, stored in the dissect event payload.
- `MeetingReview` shows an "Agenda coverage" section: goal-attainment pill + note + a covered/missed topic list.

## Honesty (§3.4/§3.5)
Goal attainment + coverage are judged from the transcript (the meeting's actual consequence), against the
meeting's pre-set plan — not the cues. A prep-less meeting has no agenda block (no regression). If the model
can't tell the goal outcome, it's "unknown", never a fabricated success.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Understanding precedes solving — coverage re-assessed from the full transcript, not assumed.",
    "how_this_build_will_embody_it": "goalAttained + covered ids judged over the diarized transcript at dissect time." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A38 via Read this turn (14:01)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Layer-2 — the review must actually report the agenda outcome, the point of prepping.",
    "how_this_build_will_embody_it": "The review shows goal attainment + covered/missed topics." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Proactive audit — prep-less unchanged; parse stays total/silent-safe; cache carries agenda.",
    "how_this_build_will_embody_it": "parseAgendaJudgment returns null with no agenda block; payload.agenda null when prep-less." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "327-347", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Honesty — no fabricated goal success; a missed topic is surfaced as missed.",
    "how_this_build_will_embody_it": "goalAttained 'unknown' when unclear; uncovered topics shown as not covered." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "356-378", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Measure consequence, not agreement — coverage is vs the meeting's own agenda, not the cues.",
    "how_this_build_will_embody_it": "The dissect never sees the cues; it judges goal/topics against the transcript." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: reused the dissect pipeline, kept parse unchanged, traced ripple, tested." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Tests lock: covered-id mapping (covered vs missed) + goalAttained + prep-less has no agenda." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T14:01:03+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check; exit-0 output in check.md." }
]
```
