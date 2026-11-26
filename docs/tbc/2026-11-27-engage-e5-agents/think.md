---
started_at: 2026-11-26T21:41:00Z
trigger: Engage plan Phase E5 (docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN/docs/07-BUILD-ORDER.md): agents, right after E4 shipped (9eb3a304).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Engage E5: agents

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: agents and agent_runs (0379); rss_agent_can_see; the notification set gains agent_ran and the webhook sets agent.ran; the runner, fired by a stage change; writeDealBrief shared; Engage → Agents.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Gong M27 automated agents: one trigger (F27.3), actions in sequence (F27.4), run-as permissions (F27.5), test, enable and run history (F27.6).
- why-this-problem-exists: everything after a deal moves stage was manual; nothing could write the brief, tell the rep, add a to-do or notify another system on its own.
- record-consulted: the deal-brief route (now writeDealBrief), notify.ts and the notification set (0336), webhooks.ts and the webhook sets (0330), rss_can_view_rep (0272), hidePhrases.hiddenFrom, the teardown's M27.
- conflicts-with-framework: NONE.
- ambiguities: E9 (run-as): the owner, by rss_agent_can_see. Date-based triggers need a cron (CRON_SECRET unset), so only event triggers are built.

## FOUR-LAYER
1. build-structure: a pure trigger match, one runner, the shared brief writer; append-only runs.
2. operational-effect: a manager sets "when a deal reaches Proposal: write the brief, notify the rep, add 'Send the proposal' due in 2 days"; moving a deal there does it; the run is listed.
3. synergetic-comp: the rep's bell links to the deal; the to-do lands on the deal and in Tasks; a webhook listener gets agent.ran.
4. surface: a sentence per agent ("When a deal reaches … : …"), runs underneath.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "External-config completeness: date-based agent triggers need a scheduled job and CRON_SECRET, unset in Vercel; they may not be depended on silently.",
    "how_this_build_will_embody_it": "Only event triggers are built; date triggers are a residual naming the precondition."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Understanding first: Gong's automated agents (M27 F27.3–F27.6) are a trigger, actions in sequence, run-as permissions, test and run history; read from the teardown, and the existing notification, webhook and brief code read before reusing them.",
    "how_this_build_will_embody_it": "Agents reuse writeDealBrief, manager_notifications, Tasks and webhook_deliveries; nothing parallel."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Holistic: agents touch notifications, webhooks, tasks and briefs; each closed set and each mirror must change together.",
    "how_this_build_will_embody_it": "0379 extends the notification and webhook sets; WEBHOOK_EVENTS, EVENT_WORDS and the bell render the new type."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Audit the neighbours while building.",
    "how_this_build_will_embody_it": "check.md covers erasure, RLS and the tree."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "One authority for writing a deal brief: writeDealBrief, now shared by the route and the agents; one for run-as: rss_agent_can_see over rss_can_view_rep.",
    "how_this_build_will_embody_it": "The brief route and the runner call writeDealBrief; the runner asks rss_agent_can_see."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Events are immutable: agents never change except on/off and retiring; runs are appended.",
    "how_this_build_will_embody_it": "Guard trigger; append-only runs."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Guide, don't overtake: an agent does only what its owner set up, only on deals its owner can see, and a test changes nothing.",
    "how_this_build_will_embody_it": "rss_agent_can_see before acting; test runs report and record only."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Erasure must reach every stored copy of the customer's words: a brief summarises and quotes them.",
    "how_this_build_will_embody_it": "Both erasure functions delete the erased deals' briefs; the probe shows 0 left."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: a point with no cited line is dropped; a brief with no points says the calls don't show enough.",
    "how_this_build_will_embody_it": "parseDealBrief drops uncited points and the unsupported standing line."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T21:46:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
