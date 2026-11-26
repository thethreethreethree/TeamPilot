---
started_at: 2026-11-26T01:37:12Z
trigger: The four reads recorded in docs/tbc/2026-11-26-filter-before-cap R1 (cap then filter).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The session list follows the reporting tree; calibration and usage read everything

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Sweeping the four recorded cap-then-filter reads, the session list turned out worse: for managers it reads the company's sessions with the service role and never applies the reporting tree, so a manager outside a rep's chain saw that rep's sessions.",
    "how_this_build_will_embody_it": "The tree verdict (treeFilterReps) now filters every page; the cap comes after the tree and hides."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:39:42Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Holistic: the session list feeds the Sales Coach and Remote Sales history pages; scanning every session would be costly for a large company.",
    "how_this_build_will_embody_it": "Pages of 500 newest-first until 300 are kept, at most 10,000 scanned; truncated says when it stopped."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Layer 2: a manager's history that shows other teams' calls, or drops their own, fails what it's for.",
    "how_this_build_will_embody_it": "A test: a rep outside the tree is left out."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Adjacent: calibration read an unordered 500 and ignored its read error; usage stopped at 1,000 people.",
    "how_this_build_will_embody_it": "Both paged and filtered after; a failed calibration read is a 500. askCoach's per-call chat list (20, own chats) left as is."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "The tree is the database's rule (0273), not outside config.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Who a manager may see is rss_tree_allows' verdict; the list didn't ask it at all.",
    "how_this_build_will_embody_it": "treeFilterReps, once per rep per request."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Read-only changes over append-only rows; nothing is written or edited.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Fewer people can now see a session's label; erasure is unaffected.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Coaching visibility, never ranking — the list stays chronological.",
    "how_this_build_will_embody_it": "Order unchanged."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision: the tree is already the rule everywhere else."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A route test for the tree; a residual for an audit that would catch a service-role list without a tree check."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:39:42Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
