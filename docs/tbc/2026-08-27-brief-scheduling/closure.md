# CLOSURE — Brief scheduling (pending item 4, the last one)

## What shipped
The final pending optional. The team training brief now has a **Day / Week toggle** (look back over the previous day or
week) and is **pre-generated overnight** — a 06:00 cron generates and caches each active company's week brief as an
append-only event, and the panel opens to that ready brief (with a "generated at" note) instead of waiting on a Build
click. The manual Build/Rebuild also caches, so a reload shows the fresh one. Reuses the events store — no new table.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). labelForDays test-locked (+2); the cron is CRON_SECRET-gated + registered in
vercel.json + maxDuration-exported (invariant audit); typecheck clean; the cache is append-only (§3.1).

## The un-named reliance
- **The cron runs only if CRON_SECRET is set (it already is, for the sibling coach crons) and Vercel schedules the
  vercel.json entry.** It fails LOUD (503) if the secret is missing, and the manual Build still works regardless — so a
  misconfigured cron degrades to "manager clicks Build", never a silent blank.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Pre-generation caches the WEEK brief (the meeting default); the day view is build-on-demand (also cached).",
    "why_skipped": "Managers run the meeting off the week brief; caching both windows nightly doubles the LLM cost for a view used on demand. Day is one Build click away and then cached.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T06:24:00+08:00",
    "outcome": "OPENED + bounded: the ready-each-morning week brief is the value; the day view is on-demand + cached, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "The pre-generation cron is sequential + capped at 10 companies/run.",
    "why_skipped": "Bounds the LLM burst under maxDuration; the current deployment has few active companies, and a larger backlog drains over nightly runs. Raising throughput (bounded concurrency) is additive if company count grows.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```

## Pass complete
All four pending optionals are now built and shipped: team practice overview, AI-written scenarios, coaching materials
library, and brief scheduling — each gated + deployed. The founder's "build the rest" pass is done.
