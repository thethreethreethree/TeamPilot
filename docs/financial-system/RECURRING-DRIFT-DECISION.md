# Decision needed — recurring-bill monthly date drift

**Status: DECISION — awaiting your call.** Flagged since 2026-07-12 (test `0140_recurring_nextdate`).
Low-severity but real: it silently walks recurring bill dates earlier over time.

## The behavior

`fin_generate_recurring` advances a monthly template with `next_date + interval '1 month'` (0140:48).
Postgres clamps an overflowing day to the month end, and **never recovers**:

```
Jan 31 → Feb 28 → Mar 28 → Apr 28 → …   (stuck on the 28th forever after the first February)
```

A bill you set for "the 31st" (or 29th/30th) permanently drifts to the 28th once it passes a February.
A bill on the 1st–28th is unaffected. So rent/subscriptions dated late in the month slowly march earlier.

## Options

| # | Rule | Behavior for a "31st" template | Cost |
|---|---|---|---|
| A | **Anchor to day-of-month** (recommended) | Jan 31 → Feb 28 → **Mar 31 → Apr 30 → May 31** (the anchored day, clamped to each month's length) | one `anchor_day` int column + clamp logic |
| B | Last-day-of-month flag | month-end templates always land on the last day | a boolean + branch |
| C | Keep calendar `+1 month` (current) | permanent drift to the 28th | none (but it's the bug) |

## Recommendation — **A (anchor to day-of-month)**

Store the template's intended day-of-month (`anchor_day`, 1–31) at creation. Each cycle, compute the
next month's date as `min(anchor_day, days_in(next_month))` — so a 15th stays the 15th, a 31st is the
31st in long months and the last day in short ones, and it **recovers** (Feb 28 → Mar 31) instead of
drifting. This matches how every billing system behaves and how a human reads "due on the 31st." B is a
narrower special case of A; C is the current bug and I'd not keep it.

## If confirmed (A)

`alter table fin_recurring_bills add column anchor_day int` (backfill `= extract(day from next_date)`),
then change the monthly/quarterly/annual advance in `fin_generate_recurring` to build the next date from
`anchor_day` clamped to the target month's length (weekly is unaffected — it stays `+ interval '1 week'`).
Add an acceptance case: a 31st template across Jan→Feb→Mar returns 31 → (28|29) → 31, not 28→28.
