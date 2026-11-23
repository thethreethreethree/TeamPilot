---
started_at: 2026-11-23T20:58:13Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md redaction "numbers spoken as words are not removed from transcripts".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Remove numbers read out in words

## The record

- D15: transcriptTextForStorage removes digit runs of 9+ digits; redact.ts stated "numbers spoken as WORDS are not
  caught".
- Production (read-only, counts only): 2,963 lines; no run of 4+ spoken digit words; 44 lines with two adjacent
  number words.

## Outside view

The risk is rare today but the harm is the one D15 exists for. A word rule must not eat ordinary speech ("two
thirty", "fifty nine ninety nine a month").

## Design

redactSpokenNumbers: a run of number words (digits, oh, teens, tens, double/triple, mixed with digit groups) whose
digit count reaches the threshold is removed — unless it is someone counting (isCounting). Runs before the digit pass
inside transcriptTextForStorage.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Understand before building: D15 removes digit runs of 9+; production was measured first — 2,963 lines, 0 runs of 4+ spoken digit words, 44 lines with two adjacent number words (ordinary speech).",
    "how_this_build_will_embody_it": "The rule uses the same 9-digit threshold, so ordinary speech is untouched; every production line was run through it before shipping."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:02:13Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Layer 2: a card read aloud in words was stored in full, exactly what D15 exists to stop.",
    "how_this_build_will_embody_it": "Spoken runs count their digits and are removed at the threshold."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Holistic: transcriptTextForStorage is used by every transcript writer (guarded by transcriptRedactionGate).",
    "how_this_build_will_embody_it": "The spoken pass runs inside it, so live lines, uploads and corrections all get it."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Look past the task: a word rule can eat ordinary speech; production showed someone counting 21→41.",
    "how_this_build_will_embody_it": "A counting exception (numbers moving one way by 1–3); production false positives went 2 → 0."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Redaction is decided in one place.",
    "how_this_build_will_embody_it": "transcriptTextForStorage remains the single decision; the spoken pass is inside it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Stored transcript lines are not rewritten.",
    "how_this_build_will_embody_it": "Applies to new lines only, as D15 does."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched; redaction stops the data being stored at all."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Guide, don't overtake: removing words from what a rep said is the system acting on their record, so it must be narrow enough never to change what they meant.",
    "how_this_build_will_embody_it": "Only 9+ digit runs, counting exempt; measured to change 0 production lines."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Honesty: the limits are stated, not hidden.",
    "how_this_build_will_embody_it": "redact.ts says what is caught and what isn't (amounts with hundred/thousand end a run; audio not altered; old lines unchanged)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: D15 already decided redaction at 9 digits; this extends it to spoken digits."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "redact.test.ts pins spoken runs removed, ordinary speech and production's counting kept; transcriptRedactionGate still guards every writer."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:02:13Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
