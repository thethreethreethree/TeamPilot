---
started_at: 2026-11-23T22:33:10Z
trigger: OPEN.md transcript-edits "per-line speaker changes are not offered". Also: ticked two OPEN.md entries already resolved (mfa functions 0315; null-form client reads).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Correct who said a transcript line

## The record

- 0311 edit_transcript_line: lock, copy the current version with one line's words changed, edit row.
- speaker values: agent / customer / unknown.

## Outside view

Wrong speakers distort talk time and coaching more than a misheard word; the fix belongs in the same editor.

## Design

0328: transcript_line_edits.field ('text'|'speaker'); edit_transcript_speaker. Route POST { seq, speaker }; GET returns
latestEditAt. Editor: "Said by the customer/rep".

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Understand before building: 0311 corrects a line's words as a new transcript version with an edit row; speaker labelling can credit single lines to the wrong person; the residual asked for a speaker choice recorded the same way.",
    "how_this_build_will_embody_it": "A sibling function edit_transcript_speaker on the same lock, the same versioning and the same edit table (with a 'field')."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T22:35:13Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Layer 3: a rep who sees their customer's objection labelled as their own should fix it where they fix words.",
    "how_this_build_will_embody_it": "'Said by the customer / rep' in the same line editor."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Holistic: talk stats, keyword hits (by side) and the AI notes all read speakers.",
    "how_this_build_will_embody_it": "Talk stats and trackers are redone after the change; a speaker change also dates the AI notes (latestEditAt) so the refresh is offered."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Look past the task: the 'edited' mark compares words, so a speaker-only edit would leave no sign.",
    "how_this_build_will_embody_it": "The edit row records field 'speaker'; the audit row too; the notes-staleness check uses the newest edit of any kind."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0328 applied to production; live checks re-run."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Who may change a line is the same decision for words and speaker.",
    "how_this_build_will_embody_it": "The same access() check in the same route."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Earlier transcript versions must stay.",
    "how_this_build_will_embody_it": "A new version per change; version 1 kept (replayed)."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Legal erasure deletes every version of a call's lines; a new version must not escape it.",
    "how_this_build_will_embody_it": "Versions live in coaching_transcript_segments, which rss_erase_sessions already deletes by session."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Guide, don't overtake: the person corrects; nothing is relabelled automatically.",
    "how_this_build_will_embody_it": "A button per line in the editor."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Honesty: a wrong speaker skews talk-time and the coaching read.",
    "how_this_build_will_embody_it": "The fix flows to talk stats and trackers at once; the notes are flagged as older."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "PGlite replay of the function; route tests (allowed, bad speaker, stranger); render tests (button sends speaker; speaker-only edit offers the refresh)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T22:35:13Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
