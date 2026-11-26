---
started_at: 2026-11-26T01:28:47Z
trigger: The full gate failed on PitchPerformance.render ("Unable to find … Blue door"); the file passed 3 of 3 alone.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - One wait budget for every render test

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "The gate failed on PitchPerformance's 'Blue door' and the file passed three times alone: the cause is Testing Library's 1 s wait under full-gate load, the same cause RecordingsTab recorded on 2026-09-22.",
    "how_this_build_will_embody_it": "One budget for every DOM test instead of per-file fixes."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T01:29:31Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "Holistic: a setup file runs for every test file; it must not load a DOM library into the node-only suite.",
    "how_this_build_will_embody_it": "It imports Testing Library only when a document exists."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "Layer 2 for the gate itself: a gate that flakes teaches people to re-run instead of read.",
    "how_this_build_will_embody_it": "5 s budget, still far under the 20 s test timeout so a hang still fails."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "Adjacent: RecordingsTab's own 4 s override is now redundant but harmless.",
    "how_this_build_will_embody_it": "Left in place; the global value is higher."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "One budget decided once in setup, not re-chosen per file.",
    "how_this_build_will_embody_it": "vitest.setup.ts is the single place."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "Test tooling only; no product data path or event is involved in this change.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "Test tooling only; nothing here stores or reads customer data, so erasure is unaffected.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "Test tooling only; no product behaviour or guidance changes.",
    "how_this_build_will_embody_it": "No product surface touched."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "testingLibraryBudget.test.ts asserts the budget applies."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T01:29:31Z",
    "why_it_governs": "A green claim is about the canonical command; a flaky gate erodes that.",
    "how_this_build_will_embody_it": "The full npm run check is the commit gate."
  }
]
```
