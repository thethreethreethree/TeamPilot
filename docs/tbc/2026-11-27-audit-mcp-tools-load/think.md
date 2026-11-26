---
started_at: 2026-11-26T22:54:00Z
trigger: Proactive audit (§1.5.2) of the MCP tools shipped in 18ab81dd.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Audit: MCP tool load and limits

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: dealCalls.ts (loadCallsByIds), mcpTools.ts, the MCP route's maxDuration; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: keep building; audit what shipped today.
- why-this-problem-exists: ask_account reused the per-deal loader deal by deal, so every deal's transcripts loaded before the newest five were chosen; the MCP route kept E4's 60s from before an AI write existed; id lists were sized by row limits, not URL size.
- record-consulted: mcpTools.ts, dealCalls.ts, the brief route (maxDuration 90), the MCP route.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one loader, used by both.
2. operational-effect: an account ask loads at most five transcripts; generate_brief has the brief page's time.
3. synergetic-comp: deal reads unchanged.
4. surface: n/a.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Outside settings: none new; Postmark, Twilio, CRON_SECRET, SUPABASE_JWT_SECRET stay recorded in OPEN.md.",
    "how_this_build_will_embody_it": "No new outside dependency."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Understand first: auditing today's MCP tools found ask_account loading up to 50 transcripts to keep 5, generate_brief capped at 60s where the same AI read gets 90s, and id lists up to 1,000 in one URL.",
    "how_this_build_will_embody_it": "Load only the kept calls (loadCallsByIds); 90s; ID_CAP 200."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Holistic: loadDealCalls is split so the deal reads and the account ask share one loader.",
    "how_this_build_will_embody_it": "loadDealCalls' behaviour is unchanged (same filters, order, budget)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Proactive audit of the surfaces shipped today.",
    "how_this_build_will_embody_it": "These three findings."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "One loader for 'the newest sales calls with transcripts' (loadCallsByIds), not a second copy.",
    "how_this_build_will_embody_it": "loadDealCalls calls it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Nothing is merged or rewritten: a near match is shown, a person moves deals.",
    "how_this_build_will_embody_it": "No write path."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Guide, don't overtake: each warning says what to do; duplicates are suggested, never merged.",
    "how_this_build_will_embody_it": "RISK_FIX text; nearMatches only displays."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Erasure: nothing new stored.",
    "how_this_build_will_embody_it": "No new table or column."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Nothing half-understood: a warning shows only when dealRisk raised it from a read fact.",
    "how_this_build_will_embody_it": "Same rule as the list."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T22:56:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
