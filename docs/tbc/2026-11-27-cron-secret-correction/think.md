---
started_at: 2026-11-26T23:14:00Z
trigger: Deploy check of 92249504: the nightly cron route answers 401 in production, so CRON_SECRET is set, contrary to the record.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - CRON_SECRET is set: correct the record; deal brief render test

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: OPEN.md, the two plan READMEs, one sentence in the agent editor; a DealBrief render test.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: verify what shipped is live; keep the record true.
- why-this-problem-exists: the "unset" was carried forward from an earlier note, never checked against the deployment.
- record-consulted: the cron route (401 only when the secret is set; 503 when unset), curl of the live route, OPEN.md.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: docs and one UI sentence.
2. operational-effect: the job runs nightly from 2026-11-28 05:15 UTC.
3. synergetic-comp: n/a.
4. surface: the editor no longer says the job waits on a secret.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "External config verified against the live deployment, not assumed.",
    "how_this_build_will_embody_it": "GET without the secret → 401, not 503."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Understand first: the record said CRON_SECRET was unset; the deployed route's 401 'Cron authentication failed.' (only possible with the secret set) shows it is set.",
    "how_this_build_will_embody_it": "OPEN.md, the plan READMEs and the agent editor corrected from the evidence."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Holistic: the runner reuses listProspects (pinned), dealRisk, runAgent; drivers past and present share one rule.",
    "how_this_build_will_embody_it": "driversOf behind dealDrivers and driversFromSnapshots."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Proactive: a render test for the deal brief (open residual R1 of the render-tests record).",
    "how_this_build_will_embody_it": "Cites, to-do once, stale, failed read."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "One verdict: snapshots store dealRisk's reasons; drivers read them by the same rule.",
    "how_this_build_will_embody_it": "No warning logic in SQL or the route."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Append-only: snapshots never change (rules), once per deal per day.",
    "how_this_build_will_embody_it": "Probe: update ignored, duplicate refused."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Erasure: snapshots hold no customer words (deal id, rep, warning kinds), so they're kept as non-personal facts.",
    "how_this_build_will_embody_it": "No erasure step needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T23:16:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
