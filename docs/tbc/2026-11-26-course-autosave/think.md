---
started_at: 2026-11-26T07:50:00Z
trigger: Gong ledger F17.1 — "Still missing: autosave".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Course editor autosave

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Ledger F17.1's last gap: Gong's course builder autosaves; ours lost a half-written course on a reload or closed tab.",
    "how_this_build_will_embody_it": "The editor keeps the unsaved draft in this browser and offers it back."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T10:29:35Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Holistic: a draft of an edited course must not overwrite a newer version someone else saved; the server's versioning stays the source of truth.",
    "how_this_build_will_embody_it": "A draft remembers the version it started from and is dropped if the course has moved on."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Layer 3: the manager returns to the editor and continues; they can also start over.",
    "how_this_build_will_embody_it": "'Picked up your unsaved changes … Start over'."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Adjacent: browser storage can be missing or throw (private windows); the editor must work without it.",
    "how_this_build_will_embody_it": "Every read and write is wrapped; no storage = no autosave."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "No outside configuration.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "The saved course is the server's; the draft is only a convenience and never read as the course.",
    "how_this_build_will_embody_it": "Saving still goes through the routes; the draft is cleared on save or cancel."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Course versions stay append-only on the server; the browser draft is not a record.",
    "how_this_build_will_embody_it": "No server change."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a lesson draft is the manager's own text in their own browser.",
    "how_this_build_will_embody_it": "No customer data stored."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "The manager decides whether to keep or drop the draft.",
    "how_this_build_will_embody_it": "Start over / Cancel drop it."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A render test for restore, start over and clear on save."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T10:29:35Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command."
  }
]
```
