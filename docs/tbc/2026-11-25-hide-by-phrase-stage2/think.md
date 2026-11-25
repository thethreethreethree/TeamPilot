---
started_at: 2026-11-25T11:12:34Z
trigger: Gong ledger F33.8 stage 2 (residual R1/R2 of docs/tbc/2026-11-25-hide-by-phrase); founder picker "Real hide, in stages".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A hidden call's remaining rows, and a list of hidden calls (stage 2a)

## Design

0339: the 0337 restrictive read rule on after_pitch_summaries, coaching_cues, coaching_cue_outcomes, tracker_hits,
session_interaction_stats, transcript_line_edits, library_items, manager_notifications (by session_id) and on
pitch_score_elements, pitch_score_events, pitch_score_overrides, recording_comments, recording_share_events (by pitch_id,
through a definer helper). hiddenCallsForCompany + the GET of hide-phrases → a "Hidden calls" list in Protection.
hiddenFrom reads call_hides once before asking the SQL rule.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "Stage 1 left a hidden call's tracker hits, comments, stats, score evidence, library items and notices readable by its manager (replay: before 0339 a manager read the comment, library item, hits and stats of a hidden call).",
    "how_this_build_will_embody_it": "0339 extends the same database rule to those rows; replayed before and after."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed in full by line this session at 2026-11-25T11:12:42Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "Holistic: thirteen more tables gain a restrictive read rule; every reader of them is affected.",
    "how_this_build_will_embody_it": "Replayed as manager, rep and admin: only the manager loses rows; points and calibration deliberately untouched."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "Layer 3: an admin must be able to find a hidden call again, including one a retired phrase hid, or it is stranded.",
    "how_this_build_will_embody_it": "The Protection panel lists hidden calls with links; the call page has Unhide."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "Look past the task: hiddenFrom made one database call per call, so a 200-call list would be slow.",
    "how_this_build_will_embody_it": "One read of call_hides first; the SQL rule is asked only about calls with a hide row (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "The rule depends on 0339 being applied in production.",
    "how_this_build_will_embody_it": "db:apply applied 0339; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "The hide verdict must have one source.",
    "how_this_build_will_embody_it": "rss_pitch_hidden_from_me delegates to rss_call_hidden_from_me; hiddenFrom's prefilter is the authority's own first term and every other verdict comes from the authority."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "Append-only: nothing about a hide is deleted.",
    "how_this_build_will_embody_it": "No new tables; the hidden list is derived from call_hides minus call_unhides."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "Erasure keeps non-personal facts; hiding should not reach further than words and call identity.",
    "how_this_build_will_embody_it": "Points and calibration scores stay visible; content rows are hidden."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "The staged scope was the founder's choice.",
    "how_this_build_will_embody_it": "Picker 'Real hide, in stages'; this is stage 2a."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision taken; feedback requests left visible is recorded as a residual."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "0339 is plain SQL the audits read; route and lib tests pin the list and the prefilter."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T11:12:42Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
