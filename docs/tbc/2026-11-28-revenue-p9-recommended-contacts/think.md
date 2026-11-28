---
started_at: 2026-11-28T04:26:00Z
trigger: Revenue plan phase 9 — recommended contacts from our own calls (F26.6), next in the P3 audit's order.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Recommended contacts

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: recommendedContacts.ts; the deal route's `suggested`; the Contacts tab; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: revenue plan phase 9 rows (02, 07; decisions log), written before building.
- why-this-problem-exists: people who joined an account's calls stayed off the deal unless the rep remembered them, which also feeds the few-contacts / no-power warnings.
- record-consulted: 0370 (call_contacts_current, deal_contacts_current, contacts_current), accounts.ts readers, rank.ts, DealAccountContacts.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one reader + one pure ranking.
2. operational-effect: the Contacts tab lists who was heard, one click adds them.
3. synergetic-comp: adding feeds dealRisk's contact warnings through the existing deal_contacts.
4. surface: a dashed box under the deal's contacts.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Understand first: Gong recommends contacts from an enrichment partner we don't have; our record already says who was on which call (call_contacts, 'Who was this?'), so the honest version is people the team actually heard on the account's calls.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Holistic: the same contact readers and ranks as the Contacts tab (contactsOfAccount, rankOf); the add goes through the deal route's existing 'contact' event.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Four layers: a report an admin can read beside the keys it describes, not a separate page.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Proactive: the item read is paged to the end, not a .limit (a page of scores can carry more than 1,000 item rows).",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Fail loud: a failed suggestions read says so on the tab and doesn't fail the deal; it is never shown as 'no one to suggest'.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Single source: the hidden-call verdict is hiddenInCompanyFrom's set, consumed, not re-computed.",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Events are append-only: the report only reads api_usage.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "353-370",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Erasure: nothing new is stored; contact names come from contacts_current, which erasure already reaches.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "371-376",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "The gate on surfacing: stats are measurements, no problem is surfaced.",
    "how_this_build_will_embody_it": "Plain averages, no verdicts."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "377-390",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Guide, don't overtake: the list suggests; the rep chooses who to add and their role.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "398-411",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Checklist run before the build: decision already made by the founder picker (API + agents batch).",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Schema-complete is not built: the report must be reachable from the screen.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-28T04:26:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  }
]
```
