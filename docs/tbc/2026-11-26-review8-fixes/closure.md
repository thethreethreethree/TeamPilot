# CLOSURE - Acting on the review of the reporting-tree fixes

## What is true now

A manager can change roles only within their own reporting tree, so they can't switch the company off it; calibration
works for any company size; a team view whose tree check fails says so.

Un-named reliance: treeFilterRepsChecked mirrors treeFilterReps except for the error value; the single-rep routes still
answer a failed check with "not in your team" (safe, less precise).

## Residual

```json
[
  {"id": "R1-single-rep-503", "item": "Single-rep views (recordings, rep activity, skills, ELO) answer a failed tree check with 404 'not in your team' rather than 503.", "why_skipped": "Fails closed; distinguishing needs a checked treeAllowsRep too.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T02:08:00Z", "outcome": "Recorded."},
  {"id": "R2-comment-match", "item": "Invariant 36 matches text, so a comment naming treeFilterReps( would satisfy it.", "why_skipped": "Same as every regex invariant here.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T02:08:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
