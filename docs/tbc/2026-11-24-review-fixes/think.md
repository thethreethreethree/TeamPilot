---
started_at: 2026-11-24T22:40:45Z
trigger: Independent review (subagent) of commits 0ef7c1ee..e59b1849: N/A could zero Delivery; removed comments still counted; "1:60"; Calls bounced to Today; a false gate claim; request answers outside the read window.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Fixes from the review of the day's builds

## The record (each re-read before fixing)

1. leavesSectionAllNa ignored that Objection handling doesn't apply when deliveryScaled → Delivery 0 of 35.
2. loadCoachingEvents read recording_comments without 0333's revisions → a removed comment still counted and closed
   requests.
3. TeamCallStats mmss rounded leftover seconds → "1:60".
4. Only RemoteCallsHome wrote the Today-seen key → Calls redirected after Today was already open.
5. dissectCoachV5 is controlExempt (Sales Coach is day-1 by decision) → the draft route's "guidance off" branch and
   test described a state that can't happen.
6. coaching-metrics loaded events for 180 days of calls; a 30-day request about an older call never saw its answer.

## Outside view

Every fix is in code built today; none changes a decision.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "An independent review of the day's 15 commits (0ef7c1ee..e59b1849) found five problems and one rare case; each was re-read in the code before fixing.",
    "how_this_build_will_embody_it": "Each fix targets the confirmed cause; each has a test that fails on the old code."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T22:40:46Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "Holistic: a removed comment (0333) changes what feedback.ts counts, which feeds the inbox, the per-manager metrics, the by-rep rows and the uncoached list.",
    "how_this_build_will_embody_it": "One change in loadCoachingEvents carries to every reader."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "Layer 3: Macro Mode's Today-first rule bounced a user who had already opened Today back to it from Calls.",
    "how_this_build_will_embody_it": "Opening Today records it; Calls reads the same record."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "Look past the task: the review also found the same false 'guidance off' test name in smart trackers.",
    "how_this_build_will_embody_it": "Both renamed to what they test (the suppressed verdict is consumed)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "The Today-seen record was two copies of one decision (only Calls wrote it).",
    "how_this_build_will_embody_it": "todayShown.ts is the one place; Today and Calls use it."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "Honesty: the scenario-draft route claimed to respect the guidance gate while its engine is control-exempt.",
    "how_this_build_will_embody_it": "Comment and test now say what is true: Sales Coach AI runs from day 1 (recorded decision); the verdict is still consumed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: each fix restores the intended behaviour."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A test per fix; the #6 test was strengthened until it failed on the old route."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T22:40:46Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code, including the old-code failures."
  }
]
```
