---
started_at: 2026-11-23T20:39:02Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md security-disclosure "security reports have no alert".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Alert the founders to waiting security reports

## The record

- 0312 security_reports + security_report_events (sealed; service role behind requireVendorAdmin).
- The inbox shows status "received" when a report has no event.
- D10 (founder 2026-11-22): manager alerts are in-app only. Email sending is C.A.R.E-only.

## Outside view

A disclosure policy that promises a reply is broken if a report can sit unseen. An email would need a founders'
address and email setup outside the repo; an in-app count reaches the founders where they already work.

## Design

report.ts waitingCount; GET /api/admin/security-reports/waiting (vendor admins); SecurityWaitingBadge on the
sidebar's "Security reports" item (vendor-admin nav only), re-read on navigation.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Understand before building: the residual said a new security report waits until a founder opens the inbox; D10 keeps alerts in-app; the reports tables are sealed and read only behind requireVendorAdmin.",
    "how_this_build_will_embody_it": "An in-app count on the founders' sidebar item, read through a vendor-only route."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T20:40:33Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Layer 3: the founder already passes the sidebar; the count should take them to the inbox in one click.",
    "how_this_build_will_embody_it": "The count sits on the 'Security reports' item itself."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Holistic: the sidebar renders for every user; a vendor-only fetch must not run for customers.",
    "how_this_build_will_embody_it": "The badge renders only inside the vendor-admin nav (vendorOnly + admin role); the route checks requireVendorAdmin."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Look past the task: a count that drops on a failed read would read as 'all clear'.",
    "how_this_build_will_embody_it": "Failed read → no badge and a 500 server-side; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no email or external config (in-app only)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "'Waiting' must mean the same here as in the inbox ('received' = no status event).",
    "how_this_build_will_embody_it": "waitingCount in report.ts uses the same rule as currentStatus."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Reports and their statuses are append-only.",
    "how_this_build_will_embody_it": "Read-only count; nothing written."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Guide, don't overtake: the alert shows what waits; the founder decides.",
    "how_this_build_will_embody_it": "A count and a link; no automatic action."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Honesty: a false zero hides a report.",
    "how_this_build_will_embody_it": "Nothing shown when the count can't be read."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: D10 already says in-app; the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route test (count, founders only, failed read = 500) and render test (no badge at zero or on failure)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T20:40:33Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
