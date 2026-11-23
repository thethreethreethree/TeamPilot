# BUILD - Refresh the AI notes after transcript corrections

No migration. No env keys.

### Ask for the notes to be redone
write-path: a call → Full transcript (with corrections) → "Refresh the AI notes with these corrections" → PUT
/api/coach/sales-session/:id/transcript-edit → access() (rep or their manager) → ≥1 correction → audit
"transcript.refresh_notes" → after the response: getSessionTranscript → generateSessionArtifacts (new summary, review,
follow-through rows).
read-path: reloading the call shows the summary, review and follow-through built from the corrected transcript;
Settings → Protection's audit log lists "Refreshed a call's AI notes after corrections".
