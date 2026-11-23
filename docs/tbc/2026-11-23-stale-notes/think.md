---
started_at: 2026-11-23T21:32:32Z
trigger: OPEN.md transcript-edits "the call page doesn't say when its AI notes are older than the latest correction" (filed by docs/tbc/2026-11-23-refresh-notes).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Say when the AI notes are older than the corrections

## The record

- generateSessionArtifacts records coach.session_{summary,moments,pivot,intel}_generated events on the call.
- The transcript editor knows each correction's time (editedAt).

## Outside view

The refresh button was offered forever once a call had a correction. It should appear when it would change something.

## Design

GET transcript-edit returns notesBuiltAt (newest generated event). notesPredateCorrections decides; the editor shows a
sentence and the button only then.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Understand before building: the AI notes each record a 'generated' event on the call (summary, moments, pivot, intel), and every correction has its time; the refresh button showed whenever any correction existed, even after a refresh.",
    "how_this_build_will_embody_it": "Compare the newest notes event with the newest correction; offer the refresh only when the notes are older."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:35:17Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Layer 3: a button that stays after the job is done invites paying for the same refresh twice.",
    "how_this_build_will_embody_it": "Shown only when the notes predate the latest correction, with a line saying so."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Holistic: the editor's GET is read by the transcript component only; the events table is already read through the caller's client by Market.",
    "how_this_build_will_embody_it": "One extra read in the GET; nothing else changes."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Look past the task: a call whose notes never generated has no build time.",
    "how_this_build_will_embody_it": "Unknown counts as older (the refresh stays offered); tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "'Older than the corrections' must be decided in one place.",
    "how_this_build_will_embody_it": "notesPredateCorrections in transcriptEdits.ts; the component only calls it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "The notes' build time is read from the events already on record, not stored again.",
    "how_this_build_will_embody_it": "Read-only; the newest event decides."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Guide, don't overtake: the person still decides to refresh; the system only says the notes are behind.",
    "how_this_build_will_embody_it": "A sentence and the same button; nothing runs on its own."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Honesty: notes that quote words since corrected are a stale claim; saying so is the honest state.",
    "how_this_build_will_embody_it": "'The AI notes … were made before your latest correction.'"
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Unit test of the comparison (incl. unknown time) and a render test of fresh vs older notes."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:35:17Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
