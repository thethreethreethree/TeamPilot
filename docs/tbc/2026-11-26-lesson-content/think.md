---
started_at: 2026-11-26T05:10:00Z
trigger: Gong ledger F17.2 (P2, LACK) — lesson content blocks; residual R2 of docs/tbc/2026-11-26-training-courses.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Lesson content: a library call and an outside link

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Gong lessons hold a call or snippet and outside videos; ours held text only, so a manager teaching 'listen to how she opens' had to paste a description of a call instead of the call.",
    "how_this_build_will_embody_it": "A lesson can point at a call or clip in the company library and at an outside https page."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T05:25:38Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Holistic: who may hear a library call is decided by the library (company folder, the rep's approval — canPlay, hidden calls). A course that played calls itself would bypass that.",
    "how_this_build_will_embody_it": "The lesson only links to the library page; the library decides. The save checks the item is in a company folder and not removed."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Layer 3: the rep leaves the course for the library and must land on the call and get back; an item they can't hear must not be a silent nothing.",
    "how_this_build_will_embody_it": "?scope=company&item= opens and marks it; 'Back to Training'; plain sentences for not-for-you and older-than-shown."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Adjacent: opening on ?scope=company started two loads; the older answer arriving last would show the other tab's calls.",
    "how_this_build_will_embody_it": "Only the newest load writes (tested with a late 'mine' answer)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "0359 is applied in production; verify:live passed.",
    "how_this_build_will_embody_it": "db:verify, db:apply, verify:live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Playability is the library's verdict (canPlay); the course consumes it by sending the rep there, not by recomputing it.",
    "how_this_build_will_embody_it": "No access rule in the course code."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Lesson content is part of a step version; changing it is a new version.",
    "how_this_build_will_embody_it": "No update or delete."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a lesson stores a library item id and a manager's link, never call text.",
    "how_this_build_will_embody_it": "Erasure of a call leaves the id pointing at nothing the rep can hear."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "The manager chooses what to link; nothing is picked for them.",
    "how_this_build_will_embody_it": "No suggested calls."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "No fixed content: an empty company library says so in the picker.",
    "how_this_build_will_embody_it": "'No calls in the company library yet.'"
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; outside links are shown as links, never embedded (no third-party script on the page)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "No citation — and no allowlist reason — without reading the route: the hide-allowlist entry says the courses route returns nothing about the call, and that the library route filters hides (it calls hiddenFrom, line 178).",
    "how_this_build_will_embody_it": "Both read this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: company-folder rule, removed item, https-only links, linked-item wording, the load race."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T05:25:38Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
