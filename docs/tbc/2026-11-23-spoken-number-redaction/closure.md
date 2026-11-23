# CLOSURE - Remove numbers read out in words

## What is true now

A card, account or social security number read out in words — "four one one one, one one one one…", "double five
triple two…", "forty one, eleven, eleven…", or mixed with digits — is replaced by "[number removed]" before a
transcript line is stored, at the same 9-digit threshold as typed digits. Someone counting is left alone. On today's
production transcripts the rule would change no line. Old lines are not rewritten; the audio is not altered.

## Residual

```json
[
  {"id": "R1-hundreds", "item": "A number read with 'hundred' or 'thousand' in it (\"four thousand one hundred eleven…\") ends the run and is not removed.", "why_skipped": "Those words mark amounts (prices, years), and ids are read digit by digit or in pairs; including them would remove prices.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T21:15:00Z", "outcome": "Accepted; stated in redact.ts."},
  {"id": "R2-old-lines", "item": "Lines stored before this change are not re-checked.", "why_skipped": "Production has no spoken run of 4+ digit words, so there is nothing to clean today.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T21:15:00Z", "outcome": "Accepted; measured."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
