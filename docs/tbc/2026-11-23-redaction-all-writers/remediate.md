# REMEDIATE - Number redaction on every transcript write path

### F1 - uploaded-recording and recovery transcripts were stored without D15 redaction
Fixed: one helper, used by every writer.
gate-or-promise: gate (src/lib/__tests__/transcriptRedactionGate.test.ts)

### F2 - numbers spoken as words are still not caught
gate-or-promise: promise (OPEN.md "redaction: numbers spoken as words")
