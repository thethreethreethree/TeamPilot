---
started_at: 2026-11-24T21:17:13Z
trigger: Gong ledger F30.1 "Notification preferences" (P1, PARTIAL); founder picker 2026-11-25 "Only FYI notices".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Turn off FYI bell notices

## The record

- manager_notifications: closed type set (0332); the bell GET reads a page and a separate unread count.
- Only per-user notification setting today: care_notify_customer_reply (C.A.R.E push).

## Outside view

A muted dispute or feedback request is coaching that never happens; only notices that merely inform may go quiet.

## Design

0334 notification_mutes (type CHECK = four FYI types; append-only). mutes.ts (list, labels, latest-wins). /api/me/
notification-mutes GET/PUT. Bell GET leaves muted types out of the list and the badge (a failed read hides nothing).
Settings → Bell notices.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Ledger F30.1: one per-user toggle exists (C.A.R.E push); bell notices can't be turned off. Gong lets each user choose per notification.",
    "how_this_build_will_embody_it": "Per-type choice for the four FYI types only, as the founder chose."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T21:17:14Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Holistic: the bell list and its unread badge are separate queries; filtering one and not the other would badge notices the bell won't show.",
    "how_this_build_will_embody_it": "notMuted() applies to both queries; tested."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Layer 2: the switch must do what it shows.",
    "how_this_build_will_embody_it": "A render test drives on→off and off→on; it caught the switch sending the opposite value, fixed before shipping."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Look past the task: a mute must never hide a notice that asks someone to act.",
    "how_this_build_will_embody_it": "The DB CHECK allows only the four FYI types; a test pins the code's list to the CHECK."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0334 applied and replayed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Which types are mutable is decided once.",
    "how_this_build_will_embody_it": "MUTABLE_NOTIFICATION_TYPES mirrors the CHECK (tested); the route's enum, the panel and the bell all use it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Append-only: preferences are events.",
    "how_this_build_will_embody_it": "Each switch is a new row; the latest wins; replay shows update/delete do nothing. Notices are still written; muting only hides."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Guide, don't overtake: who may mute what was the founder's decision.",
    "how_this_build_will_embody_it": "Picker 'Only FYI notices'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The scope was a picker."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "DB CHECK, the list-equals-CHECK test, the bell filter test, the panel both-directions test."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T21:17:14Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
