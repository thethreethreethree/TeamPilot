---
started_at: 2026-11-25T11:30:22Z
trigger: Found while building F10.11 team coverage — the intel events it reads were not covered by the F33.8 hide.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A hidden call's AI reads are hidden too, and the hide checks run once per query

## Design

0341: rss_hidden_calls_for_me / rss_hidden_pitches_for_me / rss_hidden_subjects_for_me (definer, set-returning, each
asking rss_call_hidden_for); a restrictive rule on events for call subjects; every 0337/0339 rule rewritten as
`x is null or x not in (select <set>)`. hideCoverage.test.ts gates the class.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Building team coverage showed a call's AI reads live in events with a text subject, which no hide rule reached; events are readable company-wide, so a hidden call's summaries and topics stayed readable to anyone in the company.",
    "how_this_build_will_embody_it": "0341 extends the hide to call events; signed-in replay before and after."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T11:30:23Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Holistic: a restrictive rule on events and a rewrite of 21 hide rules touch every read of those tables.",
    "how_this_build_will_embody_it": "Replayed the whole manager/rep/admin matrix; timed reads against production in a rolled-back transaction before applying."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Layer 2: a 1.5-second transcript read for a manager (per-row hide function) is an operational defect, not polish.",
    "how_this_build_will_embody_it": "Set-based rules: 1,480 ms → 309 ms for 1,771 lines; events 329 ms, against 729 ms for the per-row form."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Look past the task: NOT IN drops rows whose key is null — pitch_scores.session_id is nullable.",
    "how_this_build_will_embody_it": "Every rule guards `x is null or`; replay shows a score without a call stays visible."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "The fix depends on 0341 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0341; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "The hide verdict must stay single-source.",
    "how_this_build_will_embody_it": "The sets call rss_call_hidden_for per hidden call; no new condition."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Events are append-only and the foundation of derived systems; hiding must not touch their rows.",
    "how_this_build_will_embody_it": "A read rule only; no event is changed or removed."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Erasure is the only path allowed to delete call data; the hide must only narrow reads.",
    "how_this_build_will_embody_it": "No deletes; the rule narrows SELECT only."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "The founder chose a real hide; a hide that leaves AI summaries readable is not the decision they made.",
    "how_this_build_will_embody_it": "Closes the gap rather than changing the scope; the company-wide events read is flagged, not changed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Whether events should follow the reporting tree is a founder decision; flagged in the report, not built."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "Three stages each found tables the previous stage missed — the class must be gated.",
    "how_this_build_will_embody_it": "hideCoverage.test.ts fails when a call-keyed table with text lacks the rule (mutation-checked)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T11:30:23Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
