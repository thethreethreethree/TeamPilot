---
started_at: 2026-11-24T21:28:16Z
trigger: Residual R1-row-link of docs/tbc/2026-11-24-team-call-stats (Gong F10.9: click a row for that person).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Search opens with the filters in its URL

## The record

Search builds its query with toQuery and parses saved searches with fromQuery; on load it ran the empty search only.

## Outside view

A link that lands on an unfiltered page makes the reader redo the filter by hand.

## Design

On load, fromQuery(window.location.search) → state and first run. Team call stats: name → search?rep=&from=.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "Residual R1 of the team call stats build: a rep's row couldn't open their calls because Search ignored its URL.",
    "how_this_build_will_embody_it": "Search reads its URL with the parser saved searches already use (fromQuery)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T21:28:17Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "Holistic: the server already validates every filter (parseCallSearch: rep must be a uuid, dates must parse).",
    "how_this_build_will_embody_it": "The page passes the URL's filters through the same query; nothing new to validate."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "Layer 3: from 'Ana averages 70% talk' the next step is Ana's calls in that period.",
    "how_this_build_will_embody_it": "The rep's name links to Search with rep and from set; Search opens on that search."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "Look past the task: a URL filter also makes any search shareable as a link.",
    "how_this_build_will_embody_it": "Any filter key Search knows is read; unknown keys are ignored."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "Filter parsing is decided once per side: fromQuery on the page, parseCallSearch on the server.",
    "how_this_build_will_embody_it": "Both reused; no new parser."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A render test pins that the URL's search runs first, and that no URL means the plain search."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T21:28:17Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
