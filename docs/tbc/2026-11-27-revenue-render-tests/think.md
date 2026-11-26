---
started_at: 2026-11-26T21:53:00Z
trigger: Proactive audit (§1.5.2) while an independent review of 0370–0380 runs: the new screens had no render tests.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Render tests for the revenue and Engage screens

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: tests only (RemoteEngage, DealBoard, RemoteAccount) plus the residual queue and build ledger.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: keep building while the review runs, on work it doesn't overlap.
- why-this-problem-exists: today's screens were tested through their routes and rules, not as rendered.
- record-consulted: the three components, existing render tests (RemoteSalesShell, RemotePipeline).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: tests only.
2. operational-effect: they pin mailto, the required outcome, stage grouping, unpriced counting, timeline links, not-found.
3. synergetic-comp: n/a.
4. surface: n/a.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Understanding first: the screens built today had route and rule tests but no render tests; what a person sees must be pinned too.",
    "how_this_build_will_embody_it": "Render tests for Engage Today, the deal board and the account page."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Holistic: accounts touch prospects, calls, erasure and the AI reads.",
    "how_this_build_will_embody_it": "The deal stays the prospect; erasure extended in the same function."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "One authority: the tests drive the real components against mocked routes, not a copy of their logic.",
    "how_this_build_will_embody_it": "No logic is reimplemented in the tests."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Events are immutable: the analytics read the appended activities; nothing is stored.",
    "how_this_build_will_embody_it": "No new table."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: connect rate is '—' with no outcome; a failed read is an error, not zeros.",
    "how_this_build_will_embody_it": "connectRate returns null; the route returns 500 on any failed read."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Schema-complete isn't built: a screen nothing exercises can silently stop working.",
    "how_this_build_will_embody_it": "Each new screen has a render test."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:55:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
