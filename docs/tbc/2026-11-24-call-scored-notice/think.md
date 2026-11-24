---
started_at: 2026-11-24T20:29:18Z
trigger: Gong ledger F15.13 "Notify the scored person" (P1, PARTIAL): no notice when a first AI score lands.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Tell the rep their call is scored

## The record

- notifyCallReady (0289) runs at the end of generateSessionArtifacts; finalize/label routes call scoreSession after it.
- manager_notifications: closed type set (0305 latest), dedupe (recipient_id, type, session_id) (0242).
- NotificationBell mirrors the set (enum-source) with an exhaustive switch.

## Outside view

Door reps pitch dozens of times a day and see each score at once; a bell per pitch would be noise.

## Design

0332 adds 'call_scored'. notifyCallScored (phone/video only, once per call) from scoreSession after a successful
store. Bell: "Your call with <client> is scored: N / 100 — see what went well and your next step" → the call page.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Ledger F15.13: the rep is told when a manager corrects a score and when an uploaded call is ready, but call_ready fires inside generateSessionArtifacts, before scoreSession runs, so no notice ever carries or follows the score.",
    "how_this_build_will_embody_it": "A notice from the one place a score is stored (scoreSession), after the store succeeds."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:29:19Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Holistic: manager_notifications is a closed set mirrored by NotificationBell (enum-source + exhaustive switch) and deduped per recipient, type and call.",
    "how_this_build_will_embody_it": "0332 extends the set; the bell gets its sentence and link; the dedupe index keeps one notice per call."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Layer 3: a rep who uploaded or ended a call leaves the page; the score lands minutes later and nothing brings them back to read it.",
    "how_this_build_will_embody_it": "The bell says the score and opens the call page, where Highlights and Coaching are."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Look past the task: notifying every door pitch would ring the bell dozens of times a day for scores the rep already sees on the spot.",
    "how_this_build_will_embody_it": "Phone/video only, like call_ready; door pitches unchanged."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0332 applied and replayed; no other config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Whether a call is remote is decided by isRemoteContext in scoreSession (the same branch that skips pattern detection).",
    "how_this_build_will_embody_it": "The notice is the else of that branch; the notifier re-checks the stored context."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Notifications are records; a re-score must not stack a second one.",
    "how_this_build_will_embody_it": "0242's unique index on (recipient, type, session): a repeat insert is a 23505 no-op."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Honesty: the notice states the stored total, nothing more.",
    "how_this_build_will_embody_it": "Payload total = the stored score's total, rounded."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: the ledger item and the existing call_ready precedent settle the scope."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "scoreSession tests pin phone/video yes, door no, refused score no; the bell test pins the sentence and link; the DB check refuses unknown types."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:29:19Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
