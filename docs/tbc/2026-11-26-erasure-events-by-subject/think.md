---
started_at: 2026-11-25T23:43:09Z
trigger: docs/residuals/OPEN.md 2026-11-26 · call-events-access — mis-filed call events would survive an erasure.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Legal erasure reaches a call's events wherever they were filed

## Design

0350: rss_erase_sessions = 0343's body with `delete from events where subject = any (subjects)` (no company pin) and
the task-event scrub likewise. ERASURE_EXTENSIONS gains 0350.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "rss_erase_sessions deleted a call's events only under the requesting company's id; 233 production events about one company's calls are filed under others, so an erasure would leave AI reads quoting the customer.",
    "how_this_build_will_embody_it": "Erasure deletes a call's events by subject alone (every subject is verified as the company's own call)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T23:43:10Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "Holistic: dropping a company pin in a definer function must not let one company erase another's rows.",
    "how_this_build_will_embody_it": "The function first checks every call belongs to the requesting company; only those calls' subjects are matched (replay: B's own call untouched)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "Layer 2: an erasure that leaves the customer's words is not an erasure.",
    "how_this_build_will_embody_it": "The mis-filed summary is now removed (replayed)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "Look past the task: the task-event scrub had the same company pin.",
    "how_this_build_will_embody_it": "Relaxed the same way, on task ids derived from the company's calls."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "The fix depends on 0350 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0350; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "The erasure function stays the one door (AMD-014 condition 5).",
    "how_this_build_will_embody_it": "Same function, same caller; registered in ERASURE_EXTENSIONS."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "Erasure is the only exception to append-only; it must reach every copy.",
    "how_this_build_will_embody_it": "By subject, wherever filed."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "Condition 2: delete that customer's personal data — every stored copy, nothing else.",
    "how_this_build_will_embody_it": "Exactly that customer's call events, in any company row; nothing of other calls."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "Erasure stays admin-requested and confirmed.",
    "how_this_build_will_embody_it": "Unchanged flow."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; the 233 rows' own fate stays the founder's."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "erasureCoverage asserts the latest body deletes call events by subject."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:43:10Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
