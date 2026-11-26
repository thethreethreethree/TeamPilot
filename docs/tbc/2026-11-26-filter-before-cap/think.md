---
started_at: 2026-11-26T01:34:26Z
trigger: Sweep after 204ce172 (library cap before removals) for reads capped before a filter.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Filter before the cap: coaching inbox and team assignments

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "A sweep after the library fix: 63 files cap a read with .limit(n); in six the rows are then filtered by tree, hides or removals. In the coaching inbox and team assignments that filter runs on the COMPANY's newest rows, so a manager's own team can be pushed out by other teams.",
    "how_this_build_will_embody_it": "Those two read every row in their window, filter, then cap what's shown and say when there are more."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:35:46Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Holistic: reading every row costs more; the inbox is bounded by 90 days, assignments by the company's own count, both paged.",
    "how_this_build_will_embody_it": "Paged with a unique order key; shown rows capped as before."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Layer 2: an inbox that drops a rep's request because another team was busy fails the manager it serves.",
    "how_this_build_will_embody_it": "A test pins a rep's request listed under 400 newer outside requests."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Adjacent: the other four (session list, calibration, usage, chat list) cap then filter by hides or tree in ways that drop fewer, older rows; recorded rather than changed today.",
    "how_this_build_will_embody_it": "Listed in the closure's residual."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Who a manager may see is the tree's verdict; applying it after a company-wide cap let the cap decide instead.",
    "how_this_build_will_embody_it": "The tree filter runs on every row in the window."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Requests and assignments are append-only rows; this only changes how they are read.",
    "how_this_build_will_embody_it": "Read-only change."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Request messages are erased per call (0316); reading more of them shows no erased text.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Say what's shown rather than imply it's everything.",
    "how_this_build_will_embody_it": "The inbox says when only the newest 300 are listed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A route test for the inbox; the class is recorded as a residual for an audit."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:35:46Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
