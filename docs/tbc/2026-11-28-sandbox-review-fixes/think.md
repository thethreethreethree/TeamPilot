---
started_at: 2026-11-28T12:18:00Z
trigger: Independent review of e8391351 (sandbox company).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Sandbox review fixes

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: seed.mjs (resume, errors, names, ceiling); dissectBackfill (skip sandboxes nightly); 0398 (removed people, no source); tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: fix what the review confirmed.
- why-this-problem-exists: the script made the company before the people; the backfill scans every company.
- record-consulted: the review report; dissectBackfill.ts, 0236 (source 'manual' = earbud), 0395 (removed people).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: resume instead of a second company; one filter in the nightly scan.
2. operational-effect: a stopped run finishes on re-run; no AI spend on sample calls overnight.
3. synergetic-comp: "Generate missing" inside a sandbox still works.
4. surface: the script's messages say what it did or why it stopped.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Understand first: the review of e8391351 found no signed-in path to the flag and the seed sound against the schema, but a run stopped partway stranded the admin in an empty sandbox (a re-run refused their email), and the nightly dissect backfill would spend real AI on the sample calls across companies.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "127-133",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Holistic: everyone's totals don't change (shares add up to 100); only per-person rows move. The forecast submission's snapshot is still the rep's own deals (recorded as a residual).",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Four layers (surface): a read-only view disables every control at once and drops tabs that would refuse, instead of showing working buttons that fail.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Proactive: the item read is paged to the end, not a .limit (a page of scores can carry more than 1,000 item rows).",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Fail loud: a sign-in that can't be made keeps its error; past the sign-in lookup's ceiling the script stops and says so, rather than guessing the email is free.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Single source: shareTotals uses shareOf, the same rule as the forecast; an own deal is the caller's (read by rep_id).",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Append-only: a new split is a new row; the latest is the deal's (deal_splits_current); deletes and edits do nothing.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Erasure: the sample is fictional (no customer's words); the sandbox is a company like any other for erasure.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "The gate on surfacing: stats are measurements, no problem is surfaced.",
    "how_this_build_will_embody_it": "Plain averages, no verdicts."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-380",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Guide, don't overtake: the founder runs --apply with their email; the build doesn't create accounts on their behalf.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-411",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Checklist run before the build: decision already made by the founder picker (API + agents batch).",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Schema-complete is not built: the report must be reachable from the screen.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-392",
    "read_at": "2026-11-28T12:18:00Z",
    "why_it_governs": "Sample data stays out of what learns from real companies: the nightly all-companies backfill leaves sandbox calls out; the seed refuses removed people as the split check does.",
    "how_this_build_will_embody_it": "rss_sandbox_seed refuses a company without is_sandbox; only the server sets the flag; every page in a sandbox says Sample data."
  }
]
```
