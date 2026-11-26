# BUILD - Tracker call types, and adoption that counts only what a tracker hears

Migration 0361 (keyword_trackers.channels with a phone/video check; the never-changes guard; keyword_trackers_live
re-made). No env keys.

### A manager makes a video-only tracker
write-path: POST /api/coach/remote/trackers {channels:["video"]} → keyword_trackers.channels (both → null) → smart backfill reads only video calls.
read-path: GET /trackers → channels → " · video calls only"; the keyword and smart scans → trackerAppliesTo(t, started_at, context) → no hits on phone calls; the preview reads only video calls.

### A manager reads adoption
write-path: none.
read-path: readAdoptionInputs (now with each call's context) → computeAdoption(…, scope) → only calls inside the tracker's dates and call types count → the tracker's view, the board, and by team.
