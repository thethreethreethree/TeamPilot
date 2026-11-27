---
started_at: 2026-11-27T02:27:00Z
trigger: Erasure audit of every table created in migrations 0370–0387 (§3.1.1(2)).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Erasure audit of today's tables; a saved view keeps no search text

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0388; the deal-views route; the board's save hint; a test.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: audit what shipped today; fix what the audit finds.
- why-this-problem-exists: the saved view stored the whole filter object, search box included.
- record-consulted: table list of 0370–0387; erasure bodies 0377 (notifications scrubbed by session: client_label, excerpt), 0373/0374/0377/0385; deal_board_views (0371), BoardFilters.q; production count (0 views).
- conflicts-with-framework: NONE.
- ambiguities: NONE. Covered, by table: account_events/contact_events (0370/0377), deal_element_notes (0373), deal_briefs (0374), engage_activities (0377), call events incl. topic sections (0350), manager_notifications by session (0316/0377), forecast notes refused (0381); no customer words: stage lists, playbooks, enrolments, flows (manager templates), api keys/usage, agents/runs/fires, snapshots, send claims.

## FOUR-LAYER
1. build-structure: one check, one strip.
2. operational-effect: a saved view restores its filters, not the search.
3. synergetic-comp: the board says the search isn't saved.
4. surface: a short note beside "Save view".

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Fail loud: a claim table that can't be written stops sends with a 500.",
    "how_this_build_will_embody_it": "claimErrors → 500."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Understand first: an erasure audit of every table made in 0370–0387 for stored customer words. All are reached (contacts, accounts, notes, briefs, Engage notes, call events, notification payloads by session) except a saved board view's search text and name.",
    "how_this_build_will_embody_it": "The search text isn't kept (route strips it; 0388 refuses it). The view's name is recorded as a residual."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Holistic: the runner reuses listProspects (pinned), dealRisk, runAgent; drivers past and present share one rule.",
    "how_this_build_will_embody_it": "driversOf behind dealDrivers and driversFromSnapshots."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Layer 4 / 2: an irreversible action (revoke) gets a confirm.",
    "how_this_build_will_embody_it": "Two-step revoke."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Proactive review of today's changes; a test also caught a swapped-argument bug in the rewrite before commit.",
    "how_this_build_will_embody_it": "Test-first on the rewritten scan."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "One matcher: which wordings are 'the same topic' is market.ts topicKey; SQL never re-derives it.",
    "how_this_build_will_embody_it": "The route computes the members with topicKey; the SQL only blanks the ones it is given."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-346",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Append-only: refusing the field going forward changes no row; production had 0 views.",
    "how_this_build_will_embody_it": "A check constraint, not an update."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Legal erasure must reach every stored copy of the customer's words; a saved search is usually a name.",
    "how_this_build_will_embody_it": "Not stored at all, so nothing to erase."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-473",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-634",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-819",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-11-27T02:48:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
