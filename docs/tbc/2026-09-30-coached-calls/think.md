---
started_at: 2026-09-30T02:50:00Z
trigger: Founder, picker 2026-09-30 - "Call the grade's count 'coached calls'" - after the Coach Assessment board showed a rep with "18 scored calls" beside "Recordings (0)".
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - "scored" means the rubric

## The problem, from the record

The founder's folder (docs/ELOSTATE UPDATE 9-29-2026) showed Knute Knudtson with "18 scored calls" beside
"Recordings (0)". `AgentGradeBadge.tsx:194` prints `e.gamesPlayed`, the number of calls the v5 coach graded;
`CoachAssessmentBoard.tsx:598` prints the count of rubric scores in `pitch_scores`. Both say "scored". They
count different things and will never match, even after the backlog is scored.

## The decision

The founder chose "coached calls" for the grade's count. "Scored" then means the rubric.

## Session-read manifest

Each clause below was read in full at 02:29Z for the build before this one, and reopened at 02:52:51Z
after this build started. The reopen covered its opening paragraphs, not the full text again.

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The collision was established from the code before choosing words: AgentGradeBadge counts e.gamesPlayed (the v5 coach's gradings); the Recordings tab counts pitch_scores rows (the rubric)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "Methodology in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md are in the tree and were opened at the times recorded."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "Four layers in order; layer 3 is whether the user is left able to continue.",
    "how_this_build_will_embody_it": "L2/L3: a manager reading '18 scored calls' beside 'Recordings (0)' sees a contradiction and stops trusting both; after this the two counts have different names. L4: one word, no layout change."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "Audit as you work; surface adjacent problems.",
    "how_this_build_will_embody_it": "The sweep found the same collision on gamification surfaces (weekly digest, Scoreboard: 'scored pitches/sessions' for points) against the rubric's 'Century: 100 scored pitches'. Reported to the founder, not changed: their decision covered the grade's count."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "Item 0: the wording was the founder's pick (2026-09-30), not taken on their behalf; the wider rename was surfaced rather than done."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "Methodology must be read in session, not cited from labels.",
    "how_this_build_will_embody_it": "Read at the time recorded; cited from that reading."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "A citation without an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "Timestamps are the reads', not this commit's."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "A fix is not complete until the class is a gate.",
    "how_this_build_will_embody_it": "scoredMeansRubric.test.ts fails if any of the three surfaces renders 'scored call' again (mutation: the old badge restored, 2 failed)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-09-30T02:52:51Z",
    "why_it_governs": "'Verified' is a claim about a named command.",
    "how_this_build_will_embody_it": "npm run check by name with its exit code in check.md."
  }
]
```
