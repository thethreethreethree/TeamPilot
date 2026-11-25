# BUILD - Tracker preview on 100 calls

No migration. No env keys.

### A manager previews a tracker
write-path: none (nothing stored).
read-path: Remote Sales → Trackers → "Preview on recent calls" → POST /api/coach/remote/trackers/preview → "Would catch N
mentions in X of your last 100 calls" (fewer when fewer exist, or only those inside the tracker's dates).
