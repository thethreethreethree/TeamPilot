---
started_at: 2026-11-26T01:13:44Z
trigger: Independent review of 5bed4f78 (nested folders) — one confirmed low (add by id skips ancestors), one UX gap (restore inside an archived folder), two plausible (old '/' names: 0 on production; duplicate race: pre-existing).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the review of nested folders

The add-by-id path put only the target on the restore list; the add-by-name path put the whole path. Restoring a folder
whose parent is archived recorded a restore the GET still hid. Both fixed; the two plausible items are recorded.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "The review traced the add-by-id path: only the target was put on the restore list, so an archived parent stayed archived and the saved call was hidden.",
    "how_this_build_will_embody_it": "Each ancestor is looked up and restored, tested with an archived grandparent row."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:14:08Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "Holistic: the folderName path already restored its ancestors; the folderId path, used by the API, did not — two writers of one rule.",
    "how_this_build_will_embody_it": "Both paths now fill pathIds with every folder up to the root."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "Layer 3: a Restore button that changes nothing visible is a dead end.",
    "how_this_build_will_embody_it": "A folder inside an archived one says to restore its parent first instead of offering Restore."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "Adjacent: old names with '/' would now split — checked on production (0 folders exist).",
    "how_this_build_will_embody_it": "No change needed; recorded."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "No configuration outside the repository is involved in these fixes.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "'Hidden inside an archived folder' is the server's insideArchived verdict; the page must not offer a restore that verdict would still hide.",
    "how_this_build_will_embody_it": "The page branches on insideArchived."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "Restores are appended archive events; the fix adds restore rows for ancestors, never edits a folder.",
    "how_this_build_will_embody_it": "Only library_folder_events inserts, once per folder."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "Folder names and archive events are not a customer's personal data; erasure is unaffected.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "The page should tell the person what to do next, not leave them clicking.",
    "how_this_build_will_embody_it": "A plain sentence names the step."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route and page tests for the ancestor restore and the restore note."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:14:08Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
