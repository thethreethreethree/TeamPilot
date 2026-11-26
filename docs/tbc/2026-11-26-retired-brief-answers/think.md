---
started_at: 2026-11-26T08:00:00Z
trigger: Residual R2 of docs/tbc/2026-11-26-review12-fixes — a retired template's answers couldn't be viewed.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A retired template's answers stay viewable

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Residual R2 of review 12: answers from a template that was later retired couldn't be viewed — the call's Briefs listed live templates only, so the stored answers became unreachable.",
    "how_this_build_will_embody_it": "For one call, retired templates that answered it are listed too, marked retired, view-only."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T10:45:25Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Holistic: which answers a person may see is custom_briefs' read rule (the call's access, hidden calls).",
    "how_this_build_will_embody_it": "The retired list is built from custom_briefs rows read through the caller's own client."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Layer 3: a manager who retired a template can still look back at what it said about past calls.",
    "how_this_build_will_embody_it": "'Discovery (retired)' in the picker, its answers shown, no run button."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Adjacent: a retired template must not be runnable again (the POST already refuses it).",
    "how_this_build_will_embody_it": "No 'Answer from this call' for a retired template."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "No migration and no outside configuration.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Access to answers stays the one RLS rule; the route doesn't re-derive it.",
    "how_this_build_will_embody_it": "Caller's client for custom_briefs; service role only for the template's name and questions."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Nothing is edited; retiring keeps the stored answers, and now they're reachable.",
    "how_this_build_will_embody_it": "Read-only change."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; erased answers are gone, so they can't be listed.",
    "how_this_build_will_embody_it": "The list comes from existing rows only."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "No new suggestions; past answers shown as they were.",
    "how_this_build_will_embody_it": "View only."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route and screen tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T10:45:25Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command."
  }
]
```
