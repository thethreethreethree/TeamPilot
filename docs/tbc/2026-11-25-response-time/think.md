---
started_at: 2026-11-25T00:15:57Z
trigger: Gong ledger F16.8 residual R1-response-time (docs/tbc/2026-11-25-coaching-call-counts).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Feedback response time per manager

## Design

requestAnswer → {at, managerId}; responseHoursByManager (median over answered requests made in the window); route
returns responseHours; table 'Typical response'; CSV median_response_hours.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "Ledger F16.8 residual: no feedback response time per manager; requestAnsweredAt knew when a request was answered but not by whom.",
    "how_this_build_will_embody_it": "requestAnswer returns both from the same rule; a median per manager over the window."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-25T00:15:58Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "Holistic: the inbox, the by-rep rows and this time all decide 'answered' from the same events.",
    "how_this_build_will_embody_it": "requestAnsweredAt now calls requestAnswer; one answers() rule underneath."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "Layer 2: a manager wants to know how long reps wait for them.",
    "how_this_build_will_embody_it": "A 'Typical response' column (hours or days, with how many answers) and the CSV column."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "Look past the task: an average is pulled by one slow answer; open requests have no time yet.",
    "how_this_build_will_embody_it": "Median, and only answered requests are timed (open ones show as open elsewhere)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "'Answered' is decided once (answers(); closesUnderEveryPolicy).",
    "how_this_build_will_embody_it": "requestAnswer is the source; requestAnsweredAt delegates to it."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "feedback.test.ts pins median, attribution and open-not-timed; export and render tests pin the column."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T00:15:58Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
