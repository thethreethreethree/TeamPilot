# BUILD - Acting on the review of vocabulary corrections

No migration. No env keys.

### An admin saves mis-hearings
write-path: PUT /api/coach/remote/settings/vocabulary → normaliseCorrections(…, all terms): refuses part-of-a-name, number-only, marker words, '=' and ','; merges by name.
read-path: the screen shows the refusal with its reason before saving.

### A line is stored
write-path: appendTranscriptSegment / replaceSessionTranscript → transcriptTextForStorage (redaction) → applyCorrections (one compiled pattern, literal names).
read-path: search, trackers and the call page.
