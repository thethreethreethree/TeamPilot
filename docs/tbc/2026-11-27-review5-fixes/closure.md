# CLOSURE - Review 5 fixes

## What is true now

A call or meeting still recording at six hours stops and says so, even after a drop; the server refuses any chunk past
six hours and fifteen minutes of 15-second chunks, with no clock involved. The audit API leaves out rows about calls
with an active hide and never sends hide phrases, reasons, webhook URLs, hints or other free text; it pages by
?before=<id>. Topic shares are of the whole split; the button shows on sales calls only; labels have no digits.

## Residual

```json
[
  {"id": "R1-restart-same-session", "item": "Restarting on the same call after the cap: chunks past the cap are refused; the clean-Stop recording still saves.", "why_skipped": "A new call is the way to keep recording; the message no longer suggests restarting.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T00:57:00Z", "outcome": "Recorded."},
  {"id": "R2-double-run", "item": "Two simultaneous topic-section requests on one call may both run once.", "why_skipped": "Rare; afterwards one stored split per version is reused.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T00:57:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

Both recorders keep a 15-second chunk length (CHUNK_MS).

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
