---
started_at: 2026-11-27T12:06:00Z
trigger: Engage plan E12 — fill the playbook from each call (F27.10), next in the P3 audit's order.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - E12: fill the playbook from each call

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0392; playbookReview.ts (moved from the route); agents.ts (trigger runner, action); agentSchema; template; the deal route's link; the editor; tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: Engage plan rows E12 (02, 03, 07; decisions log), written before building.
- why-this-problem-exists: the reviewer only ran when someone pressed it, so most deals' playbooks stayed empty.
- record-consulted: 0373 (deal_element_notes, deal_playbook_current has company_id), the playbook route, agents.ts (tracker trigger, brief action), the deal route's link, agent_fires (0383).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: the reviewer is one function; the trigger copies the tracker trigger's checks and the date triggers' claim.
2. operational-effect: linking a call to a deal runs the agent; the deal's Playbook tab shows the AI's evidence to validate.
3. synergetic-comp: the same reviewer as the Playbook tab's button; the same hidden-call rule.
4. surface: a sixth "when" option, a "read the playbook" action, a template.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Understand first: the P3 audit called F27.10 open, but the record shows 0373's AI Deal Reviewer already extracts cited answers per playbook element that the rep validates; the gap is only running it automatically, so E12 adds a trigger and an action, not a second extractor.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "127-133",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Holistic: the trigger reuses the nightly job's claim-before-act path (agent_fires, 0383) and dealRisk; the agents route's schema moves to one shared file.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Four layers: a template only fills the editor (no save), the manager can change any field; the agent list says what the quiet trigger means.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Proactive audit: found the route's zod schema couldn't be shared with a test; moved to agentSchema so templates are held to the route's own check.",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Fail loud, not silent: a due day that can't be read now says so, and a reminder failure is counted instead of silently skipping the company's warnings.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Single source: one reviewer run (reviewPlaybook) used by the person's 'review' and the agent action; 'may the owner hear this call' is hiddenFrom's verdict.",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Append-only: forecast_reminders is a claim table (no update/delete rules); submissions are only read.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-362",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Erasure: the reads are deal_element_notes ai_suggest rows, which 0373's erasure already deletes with the calls.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-380",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Guide, don't overtake: the AI's read is evidence the rep validates; it never overwrites a person's note.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "392-411",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Checklist: the founder picked this batch; the trigger detail is recorded in the plan (03-DATA-MODEL, decisions log) before building.",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Reachable: the trigger fires from the one place calls are linked; the template and the action are in the editor.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "363-367",
    "read_at": "2026-11-27T12:06:00Z",
    "why_it_governs": "Surfacing gate: a gone-quiet run tells the rep a fact dealRisk already shows on the deal, not a new diagnosis.",
    "how_this_build_will_embody_it": "The template's to-do is dealRisk's own advice (RISK_FIX)."
  }
]
```
