# BUILD - Remove numbers read out in words

No migration. No env keys.

### A transcript line is stored
write-path: every transcript writer (appendTranscriptSegment, replaceSessionTranscript, the line-correction route) →
transcriptTextForStorage → redactSpokenNumbers (word runs ≥ 9 digits, not counting) → redactNumbers (digit runs ≥ 9)
→ stored.
read-path: unchanged — everything reads the stored text.
