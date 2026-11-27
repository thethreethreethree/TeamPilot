---
started_at: 2026-11-27T04:05:00Z
trigger: The 4 lint warnings in every check run (DealPlaybook a11y, pipelineChanges expressions).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Clear the standing lint warnings

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: DealPlaybook.tsx (group of toggle buttons), pipelineChanges.ts summarize (statements).
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: a warning that shows every run hides a new one; clear them.
- why-this-problem-exists: a button was given role=listitem, which drops its button role and its pressed state for screen readers.
- record-consulted: eslint output; the two files; their tests.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: statements instead of comma expressions.
2. operational-effect: same counts; screen readers hear toggle buttons.
3. synergetic-comp: unchanged.
4. surface: unchanged visually.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Understand first: the 4 lint warnings are a playbook button given a role it can't carry (aria-pressed on listitem) and counter updates written as comma expressions.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "127-133",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Holistic: the run reuses askCoach whole (caller's access per call, sales calls only, hidden calls, the control gate, citations) — one path, plus save: false.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Four layers: the agent is a one-click button where the rep already asks about a deal; the manager adds and retires them in Engage → Agents.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Proactive audit of the E7–E9 batch: my own re-read and an independent review.",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "External config: none new; it runs on the existing AI provider through askCoach.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Single source: the control gate's suppressed verdict from askCoach is passed through as-is ({answer:null, suppressed}).",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Append-only: on_demand_agents is retire-only (0389 guard); answers aren't written anywhere.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Erasure: the answer quotes customer lines but isn't stored, so there's nothing for erasure to reach; the instruction is the manager's text.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-380",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Guide, don't overtake: an on-demand agent answers a question with cited lines; it acts on nothing.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-411",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Checklist: founder picked the batch; the run route was added to 05-ROUTES before building.",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Schema-complete is not built: on_demand_agents (0389) is now reachable from both surfaces.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-27T04:05:00Z",
    "why_it_governs": "Surfacing: an answer cites the lines it rests on (resolveCitations), so a rep can check it.",
    "how_this_build_will_embody_it": "The template's to-do is dealRisk's own advice (RISK_FIX)."
  }
]
```
