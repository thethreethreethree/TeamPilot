---
started_at: 2026-11-26T05:20:00Z
trigger: Residual R2 of docs/tbc/2026-11-26-interaction-alerts — no team-wide list of calls with an alert.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Team-wide list of uncoached calls with an interaction alert

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Interaction alerts were only inside one rep's list, so a manager had to open every rep to find which calls were unusual (residual R2 of the interaction-alerts build).",
    "how_this_build_will_embody_it": "One list of every rep's uncoached calls with an alert, newest first."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T05:47:25Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Holistic: the list must be built from the same calls and alerts the by-rep rows show, or the two disagree.",
    "how_this_build_will_embody_it": "Both read metrics.byRep and metrics.alerts; no new request."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Layer 3: the manager goes from 'which call?' straight to the call.",
    "how_this_build_will_embody_it": "Each row links to the call, with its alert words."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Adjacent: the per-rep list uses openRep; a shared key must not open a rep's list by mistake.",
    "how_this_build_will_embody_it": "A sentinel that can't be a rep id."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "No outside configuration; screen only.",
    "how_this_build_will_embody_it": "No config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "The alert verdict is the route's (alertsFor); the list consumes it.",
    "how_this_build_will_embody_it": "No re-derived threshold."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Read-only screen change; nothing is stored.",
    "how_this_build_will_embody_it": "No writes."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; this stores nothing.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "An alert says 'unusual for this team'; the manager listens and decides.",
    "how_this_build_will_embody_it": "Same wording as the per-rep list."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "No alerts below the 20-call baseline; the list follows the same gate.",
    "how_this_build_will_embody_it": "Hidden unless alerts.needed is 0."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A render test for the list and its hidden state."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T05:47:25Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command."
  }
]
```
