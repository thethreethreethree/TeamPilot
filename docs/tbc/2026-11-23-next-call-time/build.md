# BUILD - A time on the next call

Migration 0325 — applied to production. No env keys.

### Set the time
write-path: Pipeline → prospect card → "Next call" date + time → POST /api/coach/remote/prospects/:pid { action: "set",
kind: "next_call", value: { date, time } } → eventValue → insert remote_prospect_events (0325 CHECK on time).
read-path: remote_prospects_current.next_call_time → listProspects nextCallTime → list row "Next call: Dec 1 · 3:30 PM".

### See it on the calendar and in the reminder
write-path: none.
read-path: Pipeline → Calendar → GET calendar → booked { time } → buildWeek (timed first, in time order) → "3:30 PM ·
Acme"; card → "Add the next call … to my calendar" → buildIcs → timed event, reminder 15 minutes before.
