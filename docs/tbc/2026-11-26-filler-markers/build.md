# BUILD - Filler-word markers on the call page

No migration. No env keys.

### A manager or rep reviews a call
write-path: none.
read-path: GET /api/coach/remote/[id]/stats → loadSessionTiming → fillerMarkers (rep lines; um/uh/uhm/erm) → { moments, total, perRepMinute } → "Filler words by the rep (N · X per minute of the rep's talk)" → each moment seeks the player.
