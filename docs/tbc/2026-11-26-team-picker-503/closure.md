# CLOSURE - The team picker says when it couldn't check

## What is true now

Picking a team on any coaching or KPI screen answers "couldn't check" when the reporting tree can't be asked.

Un-named reliance: teamFromRequest's callback may return null; a caller passing the old boolean helper still works.

## Residual

```json
[
  {"id": "R1-direct-callers", "item": "13 routes call treeAllowsRep directly (comments, overrides, disputes, shares, trims, downloads, speaker names, recordings save/delete, transcript edits, patterns, scenarios, calibration POST) and answer a failed check as a refusal.", "why_skipped": "All fail closed (no data leaks); each has its own refusal wording, so moving them is per-route work.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T02:50:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
