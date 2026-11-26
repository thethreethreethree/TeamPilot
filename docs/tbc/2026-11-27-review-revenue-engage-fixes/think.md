---
started_at: 2026-11-26T22:30:00Z
trigger: Independent review of migrations 0370–0380 and their routes returned ten findings (2026-11-27).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Fixes from the review of the revenue and Engage builds

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: migration 0381; agents.ts, dealBrief.ts, playbook.ts, dealRisk.ts, mcpTools.ts, forecast.ts; the brief, playbook, prospect and forecast routes; ForecastBoard, NotificationBell; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: fix every finding of the review, without new scope.
- why-this-problem-exists, per finding:
  1. A stored brief was served from its row; the reader's hidden calls were never compared with the calls it quotes (its basis).
  2. Playbook AI reads were replayed and returned whole; their cites were never checked against the reader's hides.
  3. The tracker trigger checked the owner could see the deal, not that they could hear the call that fired it.
  4. accounts_select followed every 'account' event ever written, and contacts_select opened every contact of a visible account, so a shared or former account showed other reps' contacts.
  5. Agent notifications and webhooks stored the deal's name in payloads erasure doesn't reach.
  6. Forecast notes were free text no erasure step reaches.
  7. firstHeard compares with EARLIER versions only, so rescanning the same version fired again.
  8. Every stage save fired agents, even saving the same stage.
  9. Forecast reads stopped at 1,000 rows ordered oldest first: the newest numbers were the ones dropped.
  10. 'Ghosted' with no two-way call fired as soon as a call existed (no time measured).
- record-consulted: 0370, 0376, 0379, 0380; agents.ts, hidePhrases.ts, paginate.ts, the four routes; production counts (forecast notes 0, agent_ran notifications 0, agent.ran webhooks 0, agents 0).
- conflicts-with-framework: NONE.
- ambiguities: NONE. Finding 10's anchor is the deal's start (the customer hasn't spoken since the deal began); the last call would hide exactly the deals still being called.

## FOUR-LAYER
1. build-structure: one migration; fixes in the one place each rule lives (agents.ts, dealBrief.ts, playbook.ts, dealRisk.ts).
2. operational-effect: probed rolled back on production: notes and deal names refused; an account visible while the reader's deal is on it, not after it moves off.
3. synergetic-comp: brief and playbook readers get no brief / no AI read where it quotes a hidden call, and can write a fresh one from what they can hear.
4. surface: forecast loses its note field; the agent notification says "acted on a deal".

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Outside settings: none new; Postmark, Twilio, CRON_SECRET, SUPABASE_JWT_SECRET stay recorded in OPEN.md.",
    "how_this_build_will_embody_it": "No new outside dependency."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Understand first: each of the ten review findings was traced to the line that causes it before any change.",
    "how_this_build_will_embody_it": "think.md names the cause of each; the fix follows the cause."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Holistic: the fixes touch RLS, agents, the brief, playbook, MCP, forecast and erasure's reach.",
    "how_this_build_will_embody_it": "Each fix's neighbours are named in check.md; no erasure function changes."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Audit the neighbours: the review covered 0370–0380 and their routes.",
    "how_this_build_will_embody_it": "All ten findings fixed in this one change."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "One authority: hidden calls are judged by hiddenFrom / hiddenInCompanyFrom (rss_call_hidden_for), never re-derived.",
    "how_this_build_will_embody_it": "Brief, playbook, MCP and agents all call the same helpers."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Events are immutable: no row is edited; notes and names are refused by checks going forward (0 in production).",
    "how_this_build_will_embody_it": "Check constraints, not updates."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Guide, don't overtake: agents act only on real changes, once per call.",
    "how_this_build_will_embody_it": "stageChanged and the once-per-call record."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Erasure must reach every copy of the customer's words: forecast notes and agent payloads couldn't be reached.",
    "how_this_build_will_embody_it": "Those copies are no longer stored (checks refuse them), so erasure needs no new step."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Nothing half-understood reaches a person: 'ghosted' fired on day 0.",
    "how_this_build_will_embody_it": "Measured from the deal's start when the customer has never spoken."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T22:35:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
