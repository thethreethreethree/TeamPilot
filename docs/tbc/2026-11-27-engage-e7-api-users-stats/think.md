---
started_at: 2026-11-27T03:49:00Z
trigger: Engage plan E7 — people and team stats in the API; the usage report (founder picker: API + agents batch).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - E7: people and team stats in the API; the API usage report

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: publicApiRead users + stats; /api/v1/users, /api/v1/stats; settings/api-keys/usage; ApiKeysPanel table; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: plan rows E7 (02-FEATURE-MENU, 05-ROUTES, 07-BUILD-ORDER).
- why-this-problem-exists: outside tools could read deals and calls but not who the team is or how they're doing; admins saw 24-hour counts per key only.
- record-consulted: profiles columns (production: no email), session_interaction_stats columns, the app's team-stats route and teamCallStats, api_usage (0378) and authenticateApiKey (a daily-limit refusal isn't recorded).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: two resources in the one read handler; a pure grouping function.
2. operational-effect: GET /api/v1/users and /api/v1/stats?days=7|30|90 answer for a read key; an admin sees 7 days by key and route.
3. synergetic-comp: the same averages as Team stats; hidden calls left out as everywhere in the API.
4. surface: a table under the keys list.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Understand first: the plan row E7 asks for people and team stats in the API and a usage report; the record says profiles holds no email and api_usage has one row per request, the daily-limit refusal unrecorded.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Holistic: stats reuse the app's teamCallStats so the API and the Team stats page can't disagree.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Four layers: a report an admin can read beside the keys it describes, not a separate page.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Proactive audit: found the daily-limit 429 is never recorded, so a 'limit' column would understate.",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Fail loud: a failed usage read shows its own line rather than an empty table that reads as no traffic.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Single source: the hidden-call verdict is hiddenInCompanyFrom's set, consumed, not re-computed.",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Events are append-only: the report only reads api_usage.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "353-370",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Erasure: nothing new stores customer words (names of teammates are company data, not a customer's).",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "371-376",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "The gate on surfacing: stats are measurements, no problem is surfaced.",
    "how_this_build_will_embody_it": "Plain averages, no verdicts."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "377-390",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Guide, don't overtake: the API reports numbers; it ranks nobody.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "398-411",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Checklist run before the build: decision already made by the founder picker (API + agents batch).",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Schema-complete is not built: the report must be reachable from the screen.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-27T03:50:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  }
]
```
