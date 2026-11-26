---
started_at: 2026-11-26T23:25:00Z
trigger: OPEN.md 2026-11-20 review item "two overlapping webhook sends of one delivery can both go out".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A webhook send claims its attempt first

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: 0384; the send cron; its test; the RLS allowlist.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: close an open review item that needs no outside setting.
- why-this-problem-exists: the attempt row was the only de-duplication, written after the send.
- record-consulted: OPEN.md, send-cron/route.ts, 0286 (webhook_deliveries id bigint), erasure functions (never delete deliveries, so the FK can't block erasure).
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: one claim table, one insert before the send.
2. operational-effect: one send per attempt across overlapping runs.
3. synergetic-comp: retries unchanged (the next attempt number is a new claim).
4. surface: the cron reply counts skipped.

## Session-read manifest

```json
[
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "182-205",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Webhooks are off in production (signing secret unset); the fix is ready for when they're on.",
    "how_this_build_will_embody_it": "Tested; probed after apply via verify:live."
  },
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Understand first: OPEN.md 2026-11-20 — the webhook sender recorded an attempt only after sending, so overlapping cron runs could both send one delivery.",
    "how_this_build_will_embody_it": "0384 webhook_send_claims, inserted before sending; only the winner sends (0383's pattern)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Read at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Holistic: the runner reuses listProspects (pinned), dealRisk, runAgent; drivers past and present share one rule.",
    "how_this_build_will_embody_it": "driversOf behind dealDrivers and driversFromSnapshots."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "92-150",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "FOUR-LAYER block above."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "152-180",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Proactive: an independent review of the service-role job before its first run.",
    "how_this_build_will_embody_it": "All six findings fixed before 05:15 UTC."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "260-280",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "One verdict: snapshots store dealRisk's reasons; drivers read them by the same rule.",
    "how_this_build_will_embody_it": "No warning logic in SQL or the route."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "290-300",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Events are immutable: a claim, once written, is never changed or removed, so a lost claim can't be 'released' — staleness is handled by recording a failed attempt instead.",
    "how_this_build_will_embody_it": "webhook_send_claims has no-update/no-delete rules; closeStaleClaim appends an attempt row."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "324-340",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Agents act once per close date; the editor says it's checked each night.",
    "how_this_build_will_embody_it": "Editor copy."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "302-316",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Erasure: snapshots hold no customer words (deal id, rep, warning kinds), so they're kept as non-personal facts.",
    "how_this_build_will_embody_it": "No erasure step needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "318-322",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Nothing half-understood: a day with no record says so, never 'no warnings'.",
    "how_this_build_will_embody_it": "recorded: false → 'Nothing was recorded on …'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "420-470",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "The checklist before acting.",
    "how_this_build_will_embody_it": "Run in this record."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-459",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "The methodology document must be read from the working tree this session, not recalled from cached labels.",
    "how_this_build_will_embody_it": "The teardown, evidence and migrations named in UNDERSTANDING were opened this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Views need security_invoker, or they read past RLS.",
    "how_this_build_will_embody_it": "accounts_current and contacts_current are security_invoker."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-800",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Schema-complete isn't built: agents need a writer, a trigger point and a surface.",
    "how_this_build_will_embody_it": "Engage → Agents writes them; a stage change on a deal runs them; runs are listed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T23:28:00Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
