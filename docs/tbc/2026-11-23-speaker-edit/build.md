# BUILD - Correct who said a transcript line

Migration 0328 — applied to production. No env keys.

### Change a line's speaker
write-path: a call → Full transcript → pencil on a line → "Said by the customer" (or rep) → POST
/api/coach/sales-session/:id/transcript-edit { seq, speaker } → access() → edit_transcript_speaker (new version; edit
row field 'speaker') → audit "transcript.edit" {field: speaker} → after: trackers + talk stats redone.
read-path: the transcript shows the line under its new speaker; GET returns latestEditAt, so the AI-notes refresh is
offered when the notes predate it.
