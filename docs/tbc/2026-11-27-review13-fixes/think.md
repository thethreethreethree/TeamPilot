---
started_at: 2026-11-26T19:40:00Z
trigger: Independent review of 7c81ab49..9a7428b6 — one high, one medium, two low; one founder question.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the review of erasure, categories and the vocabulary re-apply

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "An independent review of 7c81ab49..9a7428b6 found: the vocabulary matcher wasn't idempotent if a term contained its own mis-hearing (re-applying would grow text and re-spend AI); up to 50 sequential AI re-runs could exceed the route's 300 s budget and leave calls corrected without new notes, never retried; erasure didn't take the per-call transcript lock a concurrent new version takes; the category search read was capped and unordered.",
    "how_this_build_will_embody_it": "Each fixed at its cause; recording comments put to the founder (picker: leave them)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T20:09:49Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "Holistic: the matcher serves both new lines and the re-apply; making it safe once protects both.",
    "how_this_build_will_embody_it": "Terms are matched as themselves and left exactly as written."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "Layer 2: a 'fixed' call without redone notes is a silent half-result.",
    "how_this_build_will_embody_it": "Batches of 5 with their AI re-runs in parallel inside the budget."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "Adjacent: two writers of transcript versions plus erasure must share one lock.",
    "how_this_build_will_embody_it": "Erasure takes the same advisory lock first, in a fixed order."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "0369 applied in production; the apply's own live check dropped its connection, so verify:live was run on its own: 33 passed.",
    "how_this_build_will_embody_it": "db:verify, db:apply, verify:live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "A call's category is one verdict; the search now reads it through the same paged helper as team stats.",
    "how_this_build_will_embody_it": "categoriesOf in both."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "No rows edited; the fixes are in the matcher, a batch size, a lock and a read.",
    "how_this_build_will_embody_it": "Append-only unchanged."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "Erasure must reach every stored copy of the customer's words; a version written concurrently would have been missed. Recording comments: the founder chose to leave them (picker 2026-11-27).",
    "how_this_build_will_embody_it": "The lock closes the race; OPEN.md records the comments decision."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "The founder decided the comments question in a picker.",
    "how_this_build_will_embody_it": "Recorded as decided."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "Honest cost: a re-apply must not re-spend AI on calls that already read right.",
    "how_this_build_will_embody_it": "Idempotent matcher; tested."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "Checklist item 0: the comments decision went to a picker with a recommendation first.",
    "how_this_build_will_embody_it": "Founder chose 'Leave them'."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: idempotent apply; the reader paged."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T20:09:49Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
