# BUILD - Tracker start and end dates

Migration 0344_tracker_dates.sql (applied; DB at 0344). No env keys.

### A manager creates a campaign tracker
write-path: Remote Sales → Trackers → name, phrases, Start date 2026-12-01, End date 2026-12-31 → Save → POST
/api/coach/remote/trackers {startsOn, endsOn} → keyword_trackers.starts_on / ends_on.
read-path: the list shows "scheduled from 1 Dec 2026 until 31 Dec 2026"; after that "1 Dec 2026 – 31 Dec 2026"; after
the end "ended 31 Dec 2026". Calls outside the dates get no hits.

### A smart tracker with a past start date
write-path: POST {kind: "smart", startsOn: "2026-11-01"} → backfill list = finished calls since 1 Nov (newest first, capped).
read-path: "Reading your last N calls for it now".
