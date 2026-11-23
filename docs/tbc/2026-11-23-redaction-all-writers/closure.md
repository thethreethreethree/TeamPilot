# CLOSURE - Number redaction on every transcript write path

## What is true now

Long numbers — card, account and similar numbers of 9 or more digits — are now removed from every transcript before it
is stored: live calls (as before), uploaded recordings, transcript recovery and typed corrections. Before today only
live calls were covered, so a card number read out on an uploaded call would have been kept in full. Production was
checked: no stored transcript contains such a number, so nothing needs cleaning. A test now fails if any new code
writes transcript text without the redaction.

## Residual

```json
[
  {"id": "R1-words", "item": "Numbers spoken as words ('four one one one…') are not removed (F2).", "why_skipped": "D15's stated limit; needs a word-to-digit pass.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T09:40:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R2-audio", "item": "The audio itself is not altered.", "why_skipped": "D15's stated limit; retention and 'keep transcripts only' remove audio.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T09:40:00Z", "outcome": "Stated in redact.ts."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
