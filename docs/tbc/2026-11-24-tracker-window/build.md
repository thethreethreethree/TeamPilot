# BUILD - Tracker window: only the first N minutes

Migration 0335_tracker_window.sql (applied; DB at 0335). No env keys.

### A manager adds a tracker for the first N minutes
write-path: Trackers → "Only in the first … minutes" → Add tracker → POST /api/coach/remote/trackers {withinFirstMinutes}
→ keyword_trackers.within_first_seconds.
read-path: the list shows "· first 2 min"; calls show hits only from lines said in that window (keyword and smart);
"Preview on recent calls" applies the same window.
