---
started_at: 2026-11-26T22:48:00Z
trigger: Plan check: docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/06-UI-SPEC.md ("Panel tabs: Overview · Warnings (each with its reason and mitigation) · Contacts · Activity · Playbook · Brief") and 04-REVENUE-RULES.md ("near matches go to a person as suggestions (looseKey)") were not in the code.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Deal panel tabs with warning mitigations; near-match accounts

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: dealRisk.ts (RISK_FIX), RemotePipeline (ProspectDetail tabs, DealWarnings), accountMatch.ts, RemoteAccounts; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: build what the plan says, without shortcuts.
- why-this-problem-exists: the panel grew section by section; the tabs and the Warnings tab were never laid on top. The backfill matched exact keys; the suggestion half was left out.
- record-consulted: 06-UI-SPEC.md, 04-REVENUE-RULES.md, the scaffold's rules.ts looseKey and its test, ProspectDetail, RiskLine, RemoteAccounts.
- conflicts-with-framework: NONE.
- ambiguities: NONE. Mitigation text is our own wording (Gong is research only).

## FOUR-LAYER
1. build-structure: tabs over existing sections; two pure functions (RISK_FIX table, nearMatches).
2. operational-effect: every section still reachable; Warnings lists each with a fix; duplicates named with links.
3. synergetic-comp: a duplicate's fix is the account field already on the deal panel.
4. surface: a tab row; the Warnings tab counts its warnings.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Outside settings: none new; Postmark, Twilio, CRON_SECRET, SUPABASE_JWT_SECRET stay recorded in OPEN.md.",
    "how_this_build_will_embody_it": "No new outside dependency."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Understand first: the UI spec's panel tabs (Overview · Warnings with mitigations · Contacts · Activity · Playbook · Brief) and the rules' near-match suggestions (looseKey) were not built.",
    "how_this_build_will_embody_it": "Tabs over the panel's existing sections; a Warnings tab with RISK_FIX; nearMatches on the accounts list."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Holistic: the panel's sections move into tabs; nothing they do changes.",
    "how_this_build_will_embody_it": "Each section is the same component, shown by tab; Simple view keeps Overview, Contacts, Activity."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Audit the neighbours: the list row's RiskLine and the panel now say the same warnings (one dealRisk).",
    "how_this_build_will_embody_it": "The panel reads dealRisk from the same listed deal."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "One authority: dealRisk decides warnings; the panel shows its verdict, never re-derives it. rss_account_key stays the authority for matching; looseKey only suggests.",
    "how_this_build_will_embody_it": "DealWarnings takes dealRisk's result."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Nothing is merged or rewritten: a near match is shown, a person moves deals.",
    "how_this_build_will_embody_it": "No write path."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Guide, don't overtake: each warning says what to do; duplicates are suggested, never merged.",
    "how_this_build_will_embody_it": "RISK_FIX text; nearMatches only displays."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Erasure: nothing new stored.",
    "how_this_build_will_embody_it": "No new table or column."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Nothing half-understood: a warning shows only when dealRisk raised it from a read fact.",
    "how_this_build_will_embody_it": "Same rule as the list."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T22:50:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
