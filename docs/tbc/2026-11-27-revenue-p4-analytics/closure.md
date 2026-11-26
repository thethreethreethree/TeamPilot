# CLOSURE - Revenue Phase 4: win/loss, deal drivers, account activity

## What is true now

Win/loss on Sources also breaks closed deals down by how many contacts were on them, whether a director, VP or C-level
was among them (deals with no known titles are their own row), and how long they took to close. Managers get Drivers:
per rep, the share of open deals with each warning today, the three highest per warning marked, and a team-wide note when
more than three reps have it on half their deals. Accounts show an activity level over 90 days from calls where the
customer spoke.

Un-named reliance: time to close runs from the deal's creation to the stage event that set it won or lost; a deal closed
before 0303 stage events existed has no closing date and sits in its own row.

## Residual

```json
[
  {"id": "R1-drivers-history", "item": "Drivers show today only; Gong also shows 30 and 90 days.", "why_skipped": "Needs a daily record of warnings, which needs a cron and CRON_SECRET (unset in Vercel).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T21:20:00Z", "outcome": "Recorded with Phase 3a's R1."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
