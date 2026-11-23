# BUILD - Editable transcripts

Migration 0311 (applied). No env keys or dashboard settings.

### Correct a line
write-path: a call page (Sales Coach or Remote Sales) → Full transcript → pencil on a line (shown when canEdit) →
"Save correction" → POST /api/coach/sales-session/[id]/transcript-edit { seq, text } → access(): the call's rep, or a
manager whose tree includes the rep; not while live; line present in the current, untrimmed transcript → service role
rpc edit_transcript_line (new version with that line replaced + transcript_line_edits row) → audit_log transcript.edit
→ after the response: scanSessionTrackers + storeInteractionStats on the new version.
read-path: every reader gets the corrected words through coaching_transcript_segments_current; the page says the
summary and review were written from the earlier words and can be regenerated.

### See what was corrected
write-path: none.
read-path: GET /api/coach/sales-session/[id]/transcript-edit → edits through the caller's client, the words before the
first and after the latest correction from the base table (RLS hides trimmed lines, 0295) → editMarks → an "edited"
mark on the line; clicking it shows "Originally: …", who corrected it and when. Protection → audit log lists
"Corrected a transcript line".
