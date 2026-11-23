---
started_at: 2026-11-23T09:34:00Z
trigger: Ledger audit (F33.5 "PCI scope — no card-number redaction") under the founder's standing "keep building everything in the list"; D15 redaction found missing on two write paths.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Number redaction on every transcript write path

## The record

- D15 (decisions.ts REDACTION = enabled, minDigits 9) — redactNumbers applied in appendTranscriptSegment only.
- replaceSessionTranscript (salesCoach.ts) → replace_session_transcript RPC: used by label-transcript (uploaded
  recordings), attribute-unlabelled, transcriptRecovery and its sweep — stored text as heard.
- edit_transcript_line (0311, today) — stored typed text as given.
- relabel_session_transcript copies existing text (no new text).
- Production, read-only: 0 runs of 9+ digits in any transcript version.

## Outside view

A privacy promise kept on one path out of three is broken; the comment saying "the ONE place" is how it stayed hidden.

## Design

transcriptTextForStorage() in redact.ts; used by appendTranscriptSegment, replaceSessionTranscript and the edit route;
a guard test finds any file that writes transcript text without it.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Understand before fixing: every path that writes transcript text was listed (append, replace RPC, relabel copy, the new edit RPC) and checked for redaction.",
    "how_this_build_will_embody_it": "Two writers stored text unredacted; both now use one helper."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Layer 2: D15 promised card numbers are not stored; on uploaded calls they were.",
    "how_this_build_will_embody_it": "The promise now holds on every write path."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Holistic: the uploaded-recording path is the main way phone/video calls get a transcript.",
    "how_this_build_will_embody_it": "Fixed in replaceSessionTranscript itself, so label-transcript, attribute-unlabelled and both recovery paths are covered at once."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Look past the task: auditing the ledger's PCI line found my own correction route also bypassed redaction.",
    "how_this_build_will_embody_it": "Fixed in the same change; the comment claiming 'the ONE place' was corrected."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "External config can hide a privacy failure.",
    "how_this_build_will_embody_it": "None: a code path; production was counted read-only (0 long numbers stored)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "One redaction rule for every writer.",
    "how_this_build_will_embody_it": "transcriptTextForStorage in redact.ts is the only implementation; a guard test fails if a writer skips it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Stored transcripts are append-only.",
    "how_this_build_will_embody_it": "No existing line was rewritten; production holds no 9+ digit run in any version, so no backfill is needed."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Erasure handles personal data after the fact; redaction keeps it from being stored at all.",
    "how_this_build_will_embody_it": "Redaction now applies before storage on every path, so less needs erasing later."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Redaction must not change what a rep can do with their own call; it removes numbers, not their ability to correct or coach.",
    "how_this_build_will_embody_it": "Not affected."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Honesty: the code said redaction ran at the one place lines are written; it did not.",
    "how_this_build_will_embody_it": "Comment corrected; the gap and the zero count are on the record."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision: D15 was decided; this makes it true everywhere."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "transcriptRedactionGate.test.ts; mutation check shows it fails if the edit route skips the helper."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T09:36:21Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
