---
started_at: 2026-11-23T09:45:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next ledger item F9.20 "Take notes during a call" (LACK); founder picker the same day "Rep + their managers". The erasure gap was found while designing it.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Call notes, and erasure that reaches every copy of a customer's words

## The record

- rss_erase_sessions (0285, 2026-11-20) covers transcript lines, cues, summaries, events, follow-through, tracker hits,
  library items, snippets, Ask Coach chats, and blanks labels, score evidence and callback tasks.
- After it: 0303 remote_call_briefs (key points, next steps), remote_checklist_reviews (kept items + task ids),
  remote_followup_drafts (bodies), remote_prospect_events (name, organization), remote_prospect_tasks; 0278
  feedback_requests.message; manager_notifications payloads carry client_label (call_ready) and excerpts.
- 0303's rules on those tables are unconditional "do instead nothing", so an erasure delete would be swallowed.
- Invariant 38: only 0285 may mention rss.erasure; only the erasure route calls rss_erase_sessions.

## Outside view

A notes feature is easy; the obligation it creates is not. A table of customer text that erasure doesn't know about is a
legal promise quietly broken — and it had already happened three times since 0285.

## Design

0316: call_notes (append-only; read = whoever can open the call; write = the call's rep); erasure-aware rules for the
uncovered tables; rss_erase_sessions = 0285's body + the new deletes/blanks. Notes route (redacted like transcripts) and
CallNotes on every remote call view. Guard: erasureCoverage.test.ts. Invariant 38 names 0316 as an extension.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Understand before building: adding call notes meant asking where a note's words would go on erasure; the erasure function was read against every table created since it.",
    "how_this_build_will_embody_it": "Found the Macro Mode tables uncovered; fixed with the notes."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Layer 2: reps couldn't take notes during a call (F9.20).",
    "how_this_build_will_embody_it": "CallNotes on every remote call view, live and after, stamped with the moment."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Holistic: a new table of customer text is also a new obligation for legal erasure.",
    "how_this_build_will_embody_it": "call_notes is in rss_erase_sessions from day one; a guard test now catches the next table that isn't."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Look past the task: the notes question exposed that erasing a customer left their words in briefs, drafts, checklist reviews, prospect names, feedback messages and notifications.",
    "how_this_build_will_embody_it": "All covered by 0316; the replay proves each is erased and the other customer's data kept."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "The live erasure function must actually be the new one.",
    "how_this_build_will_embody_it": "Production read after apply: the function mentions briefs, notes and notifications; 4 rules are erasure-aware."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "If a feature added its own deletion of customer text, erasure would have two definitions that could disagree about what was removed.",
    "how_this_build_will_embody_it": "Still one function, called only by the erasure route; invariant 38 names 0316 as an extension with its reason."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Notes are facts: never edited, never deleted outside erasure.",
    "how_this_build_will_embody_it": "Append-only rules on call_notes, lifted only under rss.erasure."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Erasure must delete the customer's words in every stored copy, keep the non-personal facts, and stay the only path.",
    "how_this_build_will_embody_it": "0316 extends rss_erase_sessions to every call-keyed table with text; facts (call, rep, scores, prospect amount/stage) stay; the route and function are unchanged as the single door. Following 0285's precedent for callback task titles, whole free-text fields that may quote the customer (feedback message, task titles) are blanked."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Guide, don't overtake: who reads a rep's notes was the founder's decision.",
    "how_this_build_will_embody_it": "Founder picker: the rep and their managers; the note box says so before anyone types."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Honesty: the note box must not let a rep think notes are private.",
    "how_this_build_will_embody_it": "'Your managers can read your notes on this call. Long numbers are removed.' under the box."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Who reads notes went to a picker; whether erasure should also retire practice scenarios built from a call is filed for the founder."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "erasureCoverage.test.ts reads every migration and fails on an uncovered call-keyed table with text."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T10:31:00Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
