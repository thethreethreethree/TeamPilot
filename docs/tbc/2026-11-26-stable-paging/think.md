---
started_at: 2026-11-25T23:01:14Z
trigger: Sweep after 790d1f14 — paged reads ordered by non-unique keys.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Stable order for paged reads

## Design

0347 rss_hidden_calls_for returns table(session_id); hiddenInCompanyFrom orders by it; hiddenFrom orders hide rows by
id; coverage orders intel events by created_at then id.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "A sweep after the preview fix found three of today's paged reads ordered by a non-unique key (hide rows by session, intel events by created_at, an unordered function result), which OFFSET paging can repeat or skip.",
    "how_this_build_will_embody_it": "Each read gets a unique order; the function returns a named column to order by (0347)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed in full by line this session at 2026-11-25T23:02:15Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "Holistic: changing a function's return type breaks the deployed code that reads it until the new code ships.",
    "how_this_build_will_embody_it": "Applied, then committed and pushed at once; the old shape fails to 'nothing filtered' for minutes — recorded."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "Layer 2: a hide or a coverage share that drops rows at a page boundary is wrong without any error.",
    "how_this_build_will_embody_it": "Stable orders; tests assert them."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "Look past the task: the same class exists in older routes (KPI, schedule, door log).",
    "how_this_build_will_embody_it": "Listed in OPEN.md as an audit flag, not changed here."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "The fix depends on 0347 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0347; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "The hidden set is still the one SQL verdict.",
    "how_this_build_will_embody_it": "Same body; only the return shape changed."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "Paged reads of append-only logs must read every row exactly once.",
    "how_this_build_will_embody_it": "Unique tiebreakers (id / session_id of a distinct set)."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "A read that skips a hide row could show a call meant to be hidden; erasure is not affected.",
    "how_this_build_will_embody_it": "Hide reads ordered by id."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "No behaviour change for people.",
    "how_this_build_will_embody_it": "Same results, read reliably."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "The paging class keeps returning; it needs a gate.",
    "how_this_build_will_embody_it": "Tests assert the orders; the broader sweep is flagged for an invariant."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:02:15Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
