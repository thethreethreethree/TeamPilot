---
started_at: 2026-10-02T04:14:00Z
trigger: Running the sweep named in docs/tbc/2026-10-02-an-ai-outage-fails-fast/check.md (other places an AI outage is charged to the item) found that the sales dissect writes its 14-day backoff marker when the provider is down.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - an outage is not an attempt

## The record

- `generateSalesDissect` catches any throw and returns shape `threw`; `runAndStoreDissect` then writes
  `coach.dissect_attempted`, and `dissectBackfill` skips that session for 14 days (ATTEMPT_BACKOFF_DAYS).
- The AI error reaches that catch unwrapped: `dissectCoachV5` -> `call` -> `runBrainCall` -> `llmCall` have no catch.
- Production, read-only: 6 markers with shape `threw`: 09-14 00:01, then 09-23 09:00, 12:00, 12:00, 18:00 and
  09-25 09:00. The DeepSeek balance was empty from 09-22 17:00 until the top-up. Five of the six sessions have no
  review now; each had 2 to 4 earlier attempts, so the outage cost them a retry window rather than their review.
- The meeting dissect already treats a throw as transient and writes no marker (audit H4).

## Design

`isProviderUnavailable` (errors.ts) = isProviderOutage or quota. On it the dissect returns shape
`provider_unavailable` and stores nothing, so the next backfill pass or a click retries. Other throws keep `threw`
and keep the marker (the cost-loop guard stays). The "Your read" button says the AI service is unavailable and the
recording is saved.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "Understanding precedes solving: the defect had to be shown in the record, not assumed from the code.",
    "how_this_build_will_embody_it": "Read the marker's writer and its reader first, then counted production markers by shape and date: 6 'threw', 4 of them on 09-23..25 while the balance was empty. Printed in full at the recorded time."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-34",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter; the gate's opening 13 lines printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-104",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "Four layers; layer 3 is what the feature leaves the rep able to do next.",
    "how_this_build_will_embody_it": "Layer 3 here: after an outage, the call's review comes back on the next pass instead of two weeks later; layer 4: the button says the service is down, not that the coach failed. Opening 27 lines printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-152",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "Audit as you work; the adjacent problem.",
    "how_this_build_will_embody_it": "Found by running the sweep the previous build's check.md named but had not executed: other places an outage is charged to the item. Opening 14 lines printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-325",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "One verdict, consumed; never re-derived.",
    "how_this_build_will_embody_it": "isProviderUnavailable composes isProviderOutage instead of restating its terms; the dissect consumes it. Opening 19 lines printed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "No new founder decision: this applies the founder's 2026-10-02 'wait until DeepSeek returns' to the second place an outage was charged to the item. Items 0-1 printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-462",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "Methodology read in session, not from labels.",
    "how_this_build_will_embody_it": "Context and insight paragraphs printed at the recorded time; full text read at 03:59:58Z."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-600",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry states its print time and coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-778",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "runAndStoreDissect.emit.test.ts: removing the provider_unavailable branch fails 4 tests. Opening printed; full text read at 03:59:58Z."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1008",
    "read_at": "2026-10-02T04:14:34Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Opening printed; full text read at 03:59:58Z."
  }
]
```
