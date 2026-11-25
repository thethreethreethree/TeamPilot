---
started_at: 2026-11-25T23:09:54Z
trigger: docs/residuals/OPEN.md 2026-11-26 · stable-paging (paged reads ordered by non-unique keys).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Every paged read ordered by a unique key

## Design

Add .order("id") last to 29 paged reads (routes and libs); views without id ordered by their key columns. Invariant 42:
the last .order() before .range(from, to) is "id", or the read is in PAGING_UNIQUE_ALLOWLIST with its unique key;
stale entries fail too. Schedule test mocks accept a second .order().

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "OPEN.md (2026-11-26 stable-paging): 42 paged reads were ordered by a non-unique key or none, so OFFSET pages can repeat or skip rows — KPI totals, schedules, finance sums, door counts.",
    "how_this_build_will_embody_it": "A unique last order on each, and an invariant that refuses the next one."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed in full by line at 2026-11-25T23:09:55Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "Holistic: adding an order changes nothing a caller sees except which rows a page holds; tests mock the query chain.",
    "how_this_build_will_embody_it": "Only a trailing tiebreaker is added; the existing order stays first; schedule mocks accept the extra order."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "Layer 2: a finance sum or KPI total that drops a row at a page boundary is a wrong number with no error.",
    "how_this_build_will_embody_it": "Every summed/paged read now has a unique order."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "Look past the task: views have no id; their unique key must be named, not guessed.",
    "how_this_build_will_embody_it": "Schema checked in a replay: fin views and rep_kpi_daily ordered by their key columns, listed with the reason."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "No external configuration.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "Ordering is query plumbing; no decision duplicated.",
    "how_this_build_will_embody_it": "No rule copied."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "Append-only logs are read by paging; every row must be read exactly once to replay state correctly.",
    "how_this_build_will_embody_it": "Unique tiebreakers on event/ledger reads (my-points, salesElo, events)."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "A paged read that skips a row could miss data that an erasure check or a hide depends on.",
    "how_this_build_will_embody_it": "Hide and segment reads covered by the same rule."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "No product behaviour changes.",
    "how_this_build_will_embody_it": "Same results, read reliably."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "The paging lesson recurred three times today; prose won't hold it.",
    "how_this_build_will_embody_it": "Invariant 42 in scripts/invariant-audit.mjs, mutation-checked (removing one order → a violation)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:09:55Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
