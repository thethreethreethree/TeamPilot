# CHECK - Number redaction on every transcript write path

## Commands

```
npx vitest run transcriptRedactionGate, redact, transcript-edit route → 13 passed (then 14 with the card-number case), exit 0
mutation: transcript-edit route without transcriptTextForStorage → 2 failed | 8 passed (gate + route test); restored
npm run check → exit 0 · Test Files 870 passed | 1 skipped · Tests 6529 passed | 15 skipped
```

Production, read-only, counts only (no text printed):

```
current lines with 9+ digit numbers: {"long_runs":0,"sessions":0,"companies":0}
all versions: 0
```

## Findings

### F1 - uploaded-recording and recovery transcripts were stored without D15 redaction
class: a privacy rule applied at one of several write paths, with a comment claiming it was the only one.
sweep: `grep -rln "replace_session_transcript\|edit_transcript_line\|from(\"coaching_transcript_segments\").insert" src` →
salesCoach.ts (append + replace) and the transcript-edit route; label-transcript, attribute-unlabelled and both
recovery modules call replaceSessionTranscript, so the one fix covers them.
severity: high (no exposure found: 0 long numbers stored)

### F2 - numbers spoken as words are still not caught
class: digit-only redaction (D15's stated limit).
sweep: `grep -n "spoken as WORDS" src/lib/coach/remote/redact.ts` → stated.
severity: medium
