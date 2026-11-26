# BUILD - Known mis-hearings in the transcription vocabulary

Migration 0354 (applied to production before the code). No env keys.

### An admin lists what a name is heard as
write-path: Remote Sales → Protection → Transcription vocabulary → "Spectrum = spec trum, spektrum" → PUT
/api/coach/remote/settings/vocabulary {terms, corrections} → company_stt_vocabulary (new row) + audit.
read-path: GET returns terms and corrections; the box shows "Spectrum = spec trum, spektrum".

### A call's lines are stored
write-path: appendTranscriptSegment / replaceSessionTranscript → applyCorrections(company corrections) → redaction → coaching_transcript_segments.
read-path: search, trackers and the call page see "Spectrum".
