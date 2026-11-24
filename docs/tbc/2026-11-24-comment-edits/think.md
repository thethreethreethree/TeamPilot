---
started_at: 2026-11-24T20:40:17Z
trigger: Gong ledger F9.8 "Timestamped comments with mentions and visibility" (P1, PARTIAL): no editing or deleting a comment.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Edit or remove your own call comment

## The record

- recording_comments (0259): never updated; sent_to_rep set at insert; RLS by visibility (0293).
- POST /api/coach/sales-session/pitch-recordings/comment is the only writer; readRecordings is the reader.
- 0285: comments are outside legal erasure by stated rule.

## Outside view

An overwrite would change what the rep already read with no trace; a revision keeps both.

## Design

0333 recording_comment_revisions (body or removed; append-only; RLS through the parent). applyCommentRevisions: latest
wins; removed → hidden; edited marked. PATCH (author only, same company, not after removal). UI: Edit / Remove (asks
first) on the author's comments; "edited" everywhere.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Ledger F9.8: comments have mentions and visibility but can't be edited or deleted; recording_comments rows are never updated (0259) and the route is the only writer.",
    "how_this_build_will_embody_it": "An edit is a new revision row; the original text is kept."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:40:18Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Holistic: comments are read by readRecordings into key moments for Coach Assessment, the Remote call page and the rep's pitch detail; feedback.ts counts sent comments as feedback.",
    "how_this_build_will_embody_it": "One pure rule (applyCommentRevisions) in the one reader; feedback counting unchanged (a sent comment was still sent)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Layer 3: a manager who mistyped a comment the rep will read needs to fix it in place, not add a second comment.",
    "how_this_build_will_embody_it": "Edit and Remove on the author's own comments; the rep sees the corrected text marked edited."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Look past the task: an edit after a removal would resurrect a comment its author took down; a remove could be clicked by mistake.",
    "how_this_build_will_embody_it": "The route refuses edits to a removed comment (409); Remove asks first and says the rep may have read it."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0333 applied and replayed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Who may read a comment is decided by recording_comments' RLS (0293).",
    "how_this_build_will_embody_it": "Revisions are readable exactly when their comment is (policy subquery under the parent's RLS); nothing re-derives it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Append-only: comments are never updated.",
    "how_this_build_will_embody_it": "Revisions table with no-update and no-delete rules; replay shows update/delete leave rows as they were."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Legal erasure covers stored copies of a customer's words; 0285 states comments are outside it ('anything a person retyped elsewhere').",
    "how_this_build_will_embody_it": "Revisions are comment text, so the same stated rule applies; recorded, not silently widened or narrowed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: the ledger item and append-only rule settle the design."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "DB checks and rules on the revisions table; tests for the rule, the route and the screen."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:40:18Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
