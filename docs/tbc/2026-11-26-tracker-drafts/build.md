# BUILD - Draft trackers

Migration 0352 (applied to production before the code). No env keys.

### A manager saves a tracker as a draft and puts it live later
write-path: Trackers → "Save as draft" → POST /api/coach/remote/trackers {…, draft: true} → keyword_trackers (draft = true);
later "Go live" → PATCH {id, action: "publish"} → draft = false (a smart one then reads back the last 10 calls).
read-path: the list shows a "Draft" chip; scans read keyword_trackers_live, so a draft is never matched; Search's tracker
filter and coverage leave drafts out; reps don't see drafts.

### A manager adjusts a draft
write-path: "Copy to form" → change → "Preview on recent calls" → "Save as draft" (new row); "Switch off" the old one.
read-path: the form is filled from the draft's own words, side, window and dates.
