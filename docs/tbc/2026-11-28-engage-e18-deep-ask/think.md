---
started_at: 2026-11-28T04:46:00Z
trigger: Engage plan E18 — deep Ask over more than 10 calls (F13.12), the P3 audit's last buildable item.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - E18: deep Ask

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: askCoachDeep + renumber (askCoach.ts); the ask route's deep branch; AskCalls' deep option; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Engage plan rows E18 (02, 05, 07), written before building.
- why-this-problem-exists: an account with 30 calls could only be asked about its newest 10.
- record-consulted: askCoach (10-call read, save: false, citations), askCoachTurn, the ask route, AskCalls.
- conflicts-with-framework: NONE.
- ambiguities: the cap (50 calls) is a stand-in, said in the plan row.

## FOUR-LAYER
1. build-structure: one function over askCoach, one pure renumbering.
2. operational-effect: past 10 calls, a checkbox asks all of them (up to 50); the answer cites lines across batches.
3. synergetic-comp: same Ask box, same access, same citations.
4. surface: "Ask all N calls (deep; slower, read 10 at a time)", the header says how many were read.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Understand first: Ask Coach reads up to 10 calls with cited lines through the asker's access; deep Ask is that read repeated over batches and one combining call — no new access path — with a hard cap (50 calls, 6 AI calls) because each batch costs an AI call.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Holistic: the same read and grouping as the Market rows (readMarketInputs, norm via callsNaming), so the button reads the calls its row counts.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Four layers: a report an admin can read beside the keys it describes, not a separate page.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Proactive: the item read is paged to the end, not a .limit (a page of scores can carry more than 1,000 item rows).",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Fail loud: a hidden-call check that can't run fails the read (never lets every call through); a failed claim is recorded on its agent; an API page says whether more exist.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Single source: each batch is askCoach itself (access, sales-call check, control gate); a suppressed verdict in any batch is the whole answer's; resolveCitations drops any number the combiner invents.",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "A key never changes (0378's guard): the list is set at creation; a new list is a new key. Refusals are recorded in api_usage.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "353-370",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Erasure: the battlecard isn't stored; nothing new holds a customer's words.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "371-376",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "The gate on surfacing: stats are measurements, no problem is surfaced.",
    "how_this_build_will_embody_it": "Plain averages, no verdicts."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "377-390",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Guide, don't overtake: the founder's F12.8 rule (personal folders are their owner's) is kept, not widened, by the API.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "398-411",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Checklist run before the build: decision already made by the founder picker (API + agents batch).",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Schema-complete is not built: the report must be reachable from the screen.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-28T04:46:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  }
]
```
