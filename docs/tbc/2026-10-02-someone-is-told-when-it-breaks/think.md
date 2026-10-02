---
started_at: 2026-10-02T06:06:00Z
trigger: Founder picker 2026-10-02, "Turn Sentry on", after finding production has no Sentry DSN, so error reports and the DeepSeek outage reached no one.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - someone is told when it breaks

## The record

- Production variables (names): 10, none of them SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN.
- `sentry.server.config.ts` inits on `SENTRY_DSN ?? NEXT_PUBLIC_SENTRY_DSN`; `instrumentation-client.ts` on
  `NEXT_PUBLIC_SENTRY_DSN`. Neither ran in production, so every capture was dropped.
- Only `doorlog/worker.ts` calls Sentry directly; `instrumentation.ts` forwards request errors. The breaker opened
  on 2026-10-01 with a console line only.

## What the founder chose

Turn Sentry on. Creating the project and its DSN is outside the repo and is the founder's step.

## Design

1. `/api/health` `capabilities.errorReporting.{server,browser}`, mirroring the two init guards.
2. `providerHealth.ts`: one `Sentry.captureMessage` when a streak first reaches the threshold, fixed fingerprint,
   wrapped so reporting can never break the AI path.
3. CONFIG-PRECONDITIONS-AUDIT.md: the setup step with values and a verification procedure.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "Understanding precedes solving: why did no one hear of the outage?",
    "how_this_build_will_embody_it": "Established from the record: production's variable names have no Sentry DSN, the init files guard on it, and only the pitch worker captures. Printed in full at the recorded time."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter; the gate's opening printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "Four layers; layer 2 asks whether the feature works for real, not whether its code runs.",
    "how_this_build_will_embody_it": "Sentry 'worked' by every check while delivering nothing; the health flag makes layer 2 checkable from outside. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-150",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "Audit as you work; look at the neighbours.",
    "how_this_build_will_embody_it": "The same env listing was checked against every item of CONFIG-PRECONDITIONS-AUDIT.md: Postmark still unset, cron secrets consolidated. Opening printed."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "A feature that depends on outside config is not done until that config is verified or a blocking setup step.",
    "how_this_build_will_embody_it": "The DSN is the founder's to create; it is documented with values and a verification procedure in CONFIG-PRECONDITIONS-AUDIT.md, surfaced to the founder, and made loud in /api/health. Printed in full."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-325",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "A re-derived decision must mirror its source term for term, with a test on both sides of each term.",
    "how_this_build_will_embody_it": "errorReporting re-derives the two Sentry init guards (unavoidable: they run at startup and return nothing); it cites both files and route.test.ts covers all four combinations. Printed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "The checklist, item 0: the founder's decision through the picker.",
    "how_this_build_will_embody_it": "Sentry on was the founder's pick on 2026-10-02. Items 0-1 printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Heading and tags printed at the recorded time; full text read at 03:59:58Z today."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-597",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry states its coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "Removing the report fails 2 tests; drifting the browser flag fails 1. Heading printed; full text read at 03:59:58Z."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1004",
    "read_at": "2026-10-02T06:06:58Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md; delivery to Sentry is NOT claimed until the founder's DSN exists."
  }
]
```
