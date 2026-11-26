---
started_at: 2026-11-26T08:20:00Z
trigger: Founder picker 2026-11-26 — call categories: "Rep picks at close" (ledger F10.10 / F10.9).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Call categories: an admin's list, the rep's pick

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Ledger F10.10 / F10.9: calls had no category to filter coaching by. Founder picker 2026-11-26: the rep picks one at close from a list the company admin sets — no AI guess.",
    "how_this_build_will_embody_it": "An admin list and a rep's pick per call; filters follow in the next build."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T11:29:49Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Holistic: a call's category is call metadata; who may see it must be the call's own rule (rep, tree, hidden calls).",
    "how_this_build_will_embody_it": "call_category_picks: the call brief's read rule, 0341's hidden rule, MFA."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Layer 3: the rep picks where they review a finished call; the admin keeps the list with the other company settings (Protection).",
    "how_this_build_will_embody_it": "Picker on the call page; list on Protection."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Adjacent: a renamed category would change what past picks mean; a retired one must not be pickable but past calls keep it.",
    "how_this_build_will_embody_it": "Categories are never edited (retire and add); a retired current pick shows '(retired)'."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "0367 applied in production; verify:live passed.",
    "how_this_build_will_embody_it": "db:verify, db:apply."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "A call's category is one verdict: the latest pick (currentCategories), for the page and the coming filters.",
    "how_this_build_will_embody_it": "One function."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Picking is an event: a new row, the latest wins.",
    "how_this_build_will_embody_it": "Append-only picks; no-update/no-delete rules."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a category is a company label.",
    "how_this_build_will_embody_it": "No customer data."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "The rep decides the category; the system doesn't guess it (founder choice).",
    "how_this_build_will_embody_it": "No AI suggestion."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "No fixed day-one list: a company starts with none.",
    "how_this_build_will_embody_it": "'No categories yet.'"
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Checklist item 0: the decision came through a picker with a recommendation first.",
    "how_this_build_will_embody_it": "Built as chosen."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: latest pick, names, who may pick, admin-only list, the picker."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T11:29:49Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command."
  }
]
```
