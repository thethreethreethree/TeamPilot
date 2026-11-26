---
started_at: 2026-11-26T22:58:00Z
trigger: Second independent review (3 low findings) and the nightly-job prerequisite recorded in OPEN.md (ed10b3f7).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Review fixes; a company-pinned pipeline reader

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: mcpTools.ts, forecast.ts latest(), prospects.ts listProspects(companyId); tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: fix what the review confirmed; build the prerequisite for the nightly job.
- why-this-problem-exists: the MCP deal tools filtered hides after loadDealCalls had cut to five; find_calls checked only channel; latest() used >, movement() a stable sort. listProspects was written for user clients, where RLS pins the company.
- record-consulted: the review report, mcpTools.ts, dealCalls.ts, salesOnly.ts (isSalesCall: meetings and huddles aren't sales), resolveCoachingMode.ts, prospects.ts, rss_deal_signals (0375: keyed by deal ids), dealSentiment.ts (keyed by deal ids), information_schema (every pinned table has company_id).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one loader and one sales rule reused; one pin helper in listProspects.
2. operational-effect: an MCP brief has the deal page's basis; find_calls lists sales calls only; the board and "since" agree.
3. synergetic-comp: user reads of the pipeline unchanged.
4. surface: find_calls' description says sales calls.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Outside settings: none new; Postmark, Twilio, CRON_SECRET, SUPABASE_JWT_SECRET stay recorded in OPEN.md.",
    "how_this_build_will_embody_it": "No new outside dependency."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Understand first: the second review found MCP deal reads drop hidden calls after choosing the newest five (a different basis from the deal page, so the brief is paid for twice), find_calls returns meetings and huddles, and latest()/movement() break ties differently. Separately, the nightly job's prerequisite (OPEN.md): listProspects relies on RLS.",
    "how_this_build_will_embody_it": "Hidden calls left out before choosing; isSalesCall in find_calls; ties: the later row; listProspects takes companyId and pins every table read."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Holistic: listProspects is the pipeline's one reader; a user's call is unchanged (no pin without companyId).",
    "how_this_build_will_embody_it": "A test proves both: pinned with companyId, untouched without."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Proactive: an independent review of 18ab81dd, 2e18c7cb, c2a308b5, ad5dbc41.",
    "how_this_build_will_embody_it": "Its three findings fixed; nothing high."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "One loader (loadCallsByIds) and one sales rule (isSalesCall) reused, never copied.",
    "how_this_build_will_embody_it": "dealCallsForCompany = ids − hidden → loadCallsByIds."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Nothing is merged or rewritten: a near match is shown, a person moves deals.",
    "how_this_build_will_embody_it": "No write path."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Guide, don't overtake: each warning says what to do; duplicates are suggested, never merged.",
    "how_this_build_will_embody_it": "RISK_FIX text; nearMatches only displays."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Erasure: nothing new stored.",
    "how_this_build_will_embody_it": "No new table or column."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Nothing half-understood: a warning shows only when dealRisk raised it from a read fact.",
    "how_this_build_will_embody_it": "Same rule as the list."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T23:01:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
