# BUILD - Number redaction on every transcript write path

No migration. No env keys.

### Every transcript line is stored redacted
write-path: live lines → appendTranscriptSegment; uploaded recordings, "whose voice", recovery → replaceSessionTranscript
→ replace_session_transcript; a typed correction → POST transcript-edit → edit_transcript_line — each passes its text
through transcriptTextForStorage (redact.ts; D15: 9+ digit runs → "[number removed]").
read-path: every reader of coaching_transcript_segments_current sees the redacted text.
