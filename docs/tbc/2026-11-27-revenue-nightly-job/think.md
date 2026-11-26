---
started_at: 2026-11-26T22:48:00Z
trigger: Revenue plan Phase 3a (warnings "nightly"), Phase 4 (drivers "now / 30 / 90 days") and Engage E5 ("close date near" trigger) — the last unbuilt rows whose only outside need is CRON_SECRET (OPEN.md).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The nightly revenue job

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0382; revenue/daily.ts; the cron route and vercel.json; drivers.ts, the deal-drivers route, DealDrivers; agents.ts trigger, the agents route, the agent editor; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: keep building what the plan says; build as far as the server allows, fail loud where it can't.
- why-this-problem-exists: the plan's nightly pieces were deferred for CRON_SECRET and for a reader the service role could use safely; the reader now exists.
- record-consulted: 07-BUILD-ORDER / 02-FEATURE-MENU (both plans), OPEN.md, team-brief-cron (the sibling cron pattern), listProspects(companyId), dealRisk, drivers.ts, agents.ts, 0379/0380.
- conflicts-with-framework: NONE.
- ambiguities: NONE. "Close date near" fires within N days (not exactly N) so a missed night still fires, once per deal and close date.

## FOUR-LAYER
1. build-structure: one table, one runner, one route; drivers past and present share driversOf.
2. operational-effect: tested and probed; end to end once CRON_SECRET is set (the route says so until then).
3. synergetic-comp: drivers gain Now / 30 / 90; the agent editor gains the close-date trigger.
4. surface: a day with no record says so.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "External config: CRON_SECRET is unset, so the job can't be verified end to end here.",
    "how_this_build_will_embody_it": "The route answers 503 saying so; documented in OPEN.md as the one setup step; everything else tested and probed."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Understand first: the plan's nightly warnings (3a), drivers over 30/90 days (4) and close-date agents (E5) were never built; their only outside need is CRON_SECRET, and the pinned reader they needed is now built (181e4ee3).",
    "how_this_build_will_embody_it": "0382 tables, the runner over the pinned reader, the cron route (503 until the secret), drivers history, the close-date trigger."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Holistic: the runner reuses listProspects (pinned), dealRisk, runAgent; drivers past and present share one rule.",
    "how_this_build_will_embody_it": "driversOf behind dealDrivers and driversFromSnapshots."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Audit the neighbours: agent runs must not repeat actions; a missed night must still fire.",
    "how_this_build_will_embody_it": "fire_key unique + a read before acting; the window is 'within N days', not 'exactly N'."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "One verdict: snapshots store dealRisk's reasons; drivers read them by the same rule.",
    "how_this_build_will_embody_it": "No warning logic in SQL or the route."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Append-only: snapshots never change (rules), once per deal per day.",
    "how_this_build_will_embody_it": "Probe: update ignored, duplicate refused."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Erasure: snapshots hold no customer words (deal id, rep, warning kinds), so they're kept as non-personal facts.",
    "how_this_build_will_embody_it": "No erasure step needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T22:53:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
