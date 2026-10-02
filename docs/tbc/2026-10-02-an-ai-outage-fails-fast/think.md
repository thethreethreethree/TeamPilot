---
started_at: 2026-10-02T03:59:30Z
trigger: Founder picker 2026-10-02, "DeepSeek only, fail fast", after DeepSeek stopped answering on 2026-10-01 from about 19:27 UTC and every AI call waited out its 45 s timeout.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - an AI outage fails fast

## The record

- 2026-10-01 19:27Z onward: every pitch-processing cron run timed out at 300 s. status.deepseek.com: "DeepSeek
  Web/API Degraded Performance ... being investigated". Two probes from this machine got no answer in 60 s and 90 s.
  By 2026-10-02 03:58Z a probe answered 200 in 348 ms and the cron answered 200 every minute.
- A DeepSeek call waits 45 s, then fails with kind timeout, not retried (retry.ts, founder decision 2026-08-09).
- The pitch worker gives a pitch 5 attempts with backoff, about 3.5 minutes in all (retryBackoff.ts). Only `quota`
  gives the attempt back. So an outage longer than that turns every pitch recorded during it into a terminal
  `failed`; on 2026-10-01 none were recorded, so none were lost.
- Production, read-only: 91 complete, 31 failed; none of the 31 failed by timeout (9 by the September 402s).
- Production has no second provider (`/api/health`: anthropic false).

## What the founder chose

"DeepSeek only, fail fast": remember the outage so calls fail in seconds, and let pitches wait in the queue until
DeepSeek returns.

## Design

1. `isProviderOutage` (errors.ts): timeout, server, network. The one verdict.
2. `providerHealth.ts`: after 2 such failures in a row, fail at once for 60 s; then one probe. Per instance, no DB.
3. Worker: an outage defers the pitch 5 min and gives the attempt back, for 24 h from creation; after that, the
   attempt is spent as before. `created_at` added to the claim and passed by the door-log route.

## Not yet known

How long fresh serverless instances take to learn an outage in practice; each pays at most two 45 s timeouts.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-02T03:59:55Z",
    "why_it_governs": "Understanding precedes solving: the cause of the 504s had to be established before choosing a remedy.",
    "how_this_build_will_embody_it": "Established from the record first: DeepSeek's own status page and two probes that got no answer, the worker's 3.5-minute attempt budget, and 31 failed pitches of which none timed out. Read in full at the recorded time."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-02T03:59:55Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter match; printed in full at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-104",
    "read_at": "2026-10-02T03:59:55Z",
    "why_it_governs": "Four layers; layer 3 asks whether the feature leaves the workflow intact around it.",
    "how_this_build_will_embody_it": "Layer 3 here is the rep's pitch surviving an outage and being analyzed afterwards, and live features answering in seconds instead of hanging for 45. Opening 27 lines printed at the recorded time."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-160",
    "read_at": "2026-10-02T03:59:55Z",
    "why_it_governs": "Audit as you work; look for the adjacent problem.",
    "how_this_build_will_embody_it": "The adjacent problem was the worker: fail-fast alone would have made outage pitches fail terminally FASTER. Found by reading the attempt budget before writing the breaker. Opening 22 lines printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-10-02T03:59:55Z",
    "why_it_governs": "One verdict, consumed by every consumer; never re-derived.",
    "how_this_build_will_embody_it": "isProviderOutage in llm/errors.ts is the single verdict. The breaker counts it and the worker defers on it, and the breaker's own skip error satisfies it, pinned by a test. Read in full."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-446",
    "read_at": "2026-10-02T03:59:55Z",
    "why_it_governs": "The checklist, item 0: a founder decision goes through the picker.",
    "how_this_build_will_embody_it": "The direction (DeepSeek only, fail fast) was the founder's pick on 2026-10-02; this build implements it. Items 0 to 5d printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-02T03:59:58Z",
    "why_it_governs": "Methodology read in session, not from labels.",
    "how_this_build_will_embody_it": "Printed in full at the recorded time."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-615",
    "read_at": "2026-10-02T03:59:58Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Every entry here carries its print time and how much of the clause it covered."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-02T03:59:58Z",
    "why_it_governs": "A fix is complete when the class is a gate, not prose.",
    "how_this_build_will_embody_it": "providerHealth.test.ts and the worker outage tests fail when either protection is removed (mutations: 3 and 7 failures). Read in full."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-02T03:59:58Z",
    "why_it_governs": "'Verified' names a command and its exit code.",
    "how_this_build_will_embody_it": "npm run check, with its exit code, in check.md. Read in full."
  }
]
```
