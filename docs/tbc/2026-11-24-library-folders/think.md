---
started_at: 2026-11-24T21:34:42Z
trigger: Gong ledger F12.6 "Folders with nesting and notes" and F9.16 "Listen later and add to library" (P2, PARTIAL).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Save a call to a folder you name, with a note; Listen later

## The record

0280 library_folders (owner or company; name) + library_items (note). Route: company folderName supported, mine always
"Mine". Screen: Save call / Save clip to Mine or Company only.

## Outside view

A library with one folder per person isn't organised; a listen-later list is the commonest folder there is.

## Design

Route: folderName for both scopes (normalised). Save row: Folder (suggested names), Note, Listen later.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "Ledger F12.6 / F9.16: folders and per-item notes exist (0280), but the screen saved only into 'Mine' or 'Team examples', naming a company folder was API-only, your own library had one folder, and there was no listen-later list.",
    "how_this_build_will_embody_it": "Use what 0280 already stores: a folder name for either scope and the note, from the call's save row."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T21:34:43Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "Holistic: the library page groups items by folder name and shows notes; the consent rule for company items is unchanged by which folder holds them.",
    "how_this_build_will_embody_it": "No reader changes; the library page already shows new folders and notes."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "Layer 3: a rep hears a call worth coming back to and wants it in a list without leaving the call.",
    "how_this_build_will_embody_it": "'Listen later' is one tap; any folder can be named (existing ones suggested) with a note."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "Look past the task: free-typed names would split one folder into near-duplicates ('Listen  later').",
    "how_this_build_will_embody_it": "Names are trimmed and spaces collapsed before the by-name lookup; existing names are suggested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "Which folder an item lands in is decided once, in the library route.",
    "how_this_build_will_embody_it": "The screen sends a name; the route finds or creates the folder for that scope and owner."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "Folders and items are append-only (0280).",
    "how_this_build_will_embody_it": "Folders are found by name or created; nothing is renamed or overwritten."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route tests pin by-name lookup, owner scoping, reuse and the note; the panel test pins Listen later and folder+note."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T21:34:43Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
