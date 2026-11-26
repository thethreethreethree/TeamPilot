---
started_at: 2026-11-26T01:01:22Z
trigger: Gong ledger F12.6 "Folders with nesting and notes" (P2, PARTIAL) — "Folders still can't be nested."
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Nested library folders

Timing note: the folder work was paused for the fifth review's fixes (2dc9c0c2) and resumed; the sections were printed
at 01:06:19 and 2026-11-26T01:09:21Z, after most of this build was written.

## What the record shows

0280: "No nesting this pass"; folders are immutable (no update, no delete rules) and personal (owner) or company.
The save row creates folders by NAME (find or create, 2026-11-25), and 0346 archives a folder (its items leave the
list, it can be restored; saving into it brings it back). Production holds 0 folders, none with "/" in the name.

## Design

- 0353: parent_id, fixed at creation (folders are never updated, so no moves and no loops). A BEFORE INSERT guard:
  the parent exists, same company, same library (company, or the same owner), depth ≤ 3.
- Names as paths: "Objections / Pricing" — folderPathParts (trim, collapse, ≤3 levels, ≤60 each); the route finds or
  creates each level under the one before. GET names every folder by its path (folderPaths).
- Archive: archiving a folder hides everything inside it (underArchived, derived on read); restoring brings them back;
  saving into a folder restores any archived folder on its path (once each).
- UI: the Library groups by path (subfolders after their parent); folders inside an archived one are neither listed as
  empty nor suggested; the save box takes a path.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Folders are created by name from the save row and never updated; nesting had to fit both, or it would need a folder editor and moves the schema forbids.",
   "how_this_build_will_embody_it": "A path in the same save box; the parent fixed at creation."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "Sections printed in full at 01:06:19 and 2026-11-26T01:09:21Z."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Holistic: archive (0346), restore-on-add, suggestions and the empty-folders list all assumed flat folders.",
   "how_this_build_will_embody_it": "Each now reads underArchived/path; restore-on-add covers the whole path."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-100", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Layer 3: saving into a folder inside an archived one must not land the call somewhere hidden.",
   "how_this_build_will_embody_it": "Archived folders on the path are restored (tested once each)."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-158", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Adjacent: the mock exposed two path levels resolving to one id, which would restore twice.",
   "how_this_build_will_embody_it": "The restore loop de-duplicates the path."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "No configuration outside the repository; the migration is the precondition.",
   "how_this_build_will_embody_it": "0353 applied and verified before the code is pushed."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-316", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "'Is this folder hidden' is one verdict from the archive events and the tree.",
   "how_this_build_will_embody_it": "underArchived is computed once in GET; the page and the save box consume insideArchived."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Folders and their archive events are append-only; nesting must not need an update.",
   "how_this_build_will_embody_it": "parent_id is set at insert; the no-update rule stands (replay)."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Folder names are the company's or the person's own words, not a customer's; erasure reaches the items' calls, not folder names.",
   "how_this_build_will_embody_it": "Nothing new for erasure to reach."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-379", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "The person organises their own library; the system doesn't file things for them.",
   "how_this_build_will_embody_it": "Folders are only what people type."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
   "how_this_build_will_embody_it": "No new decision: the ledger's named gap, within 0280's rules."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id here was printed at its line range this session."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "The insert trigger enforces library and depth; route, lib and page tests pin paths and archive."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T01:09:21Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
