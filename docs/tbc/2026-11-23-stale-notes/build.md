# BUILD - Say when the AI notes are older than the corrections

No migration. No env keys.

### See that the notes are behind
write-path: none.
read-path: a call → Full transcript → GET transcript-edit → edits (editedAt) + notesBuiltAt (newest coach.session_*_generated
event, caller's client) → notesPredateCorrections → "The AI notes … were made before your latest correction." and the
refresh button; otherwise neither.
