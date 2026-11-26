---
started_at: 2026-11-26T01:47:23Z
trigger: Gong ledger F13.10 "Add calls, folders, streams, files as context" (P3, PARTIAL) — folders can't be added as context.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Ask the coach about a library folder

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "F13.10: Ask Coach takes up to ten calls from Search but a Library folder — a person's own curated set — can't be asked about.",
    "how_this_build_will_embody_it": "The folder hands its calls to the same /api/coach/remote/ask the Search page uses."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:48:35Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Holistic: Ask Coach opens each call through the asker's client (RLS + tree); a company folder can hold calls a peer may hear by consent but not open.",
    "how_this_build_will_embody_it": "The box is offered only when every call in the folder is one the viewer can open."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Layer 3: asking from where the calls are collected, not by rebuilding the set in Search.",
    "how_this_build_will_embody_it": "One box per folder, answers cite the calls by name."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Adjacent: Ask Coach's ten-call limit — a larger folder must say which calls are read.",
    "how_this_build_will_embody_it": "'the newest 10 calls in this folder' when there are more."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "The AI provider is the existing Ask Coach path; nothing new outside the repository.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Whether a viewer may open a call is the library route's canOpenCall verdict.",
    "how_this_build_will_embody_it": "The page branches on canOpenCall; the ask route re-checks through RLS."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Ask Coach saves chats as before (0281); no new table or event kind is added by the folder box.",
    "how_this_build_will_embody_it": "No new write path."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Chats over erased calls are handled by erasure already (Ask Coach chats).",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "The person asks the question; the coach answers with citations, it doesn't decide anything.",
    "how_this_build_will_embody_it": "A question box; cited answer."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A render test: offered and sent for an openable folder; not offered otherwise."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:48:35Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
