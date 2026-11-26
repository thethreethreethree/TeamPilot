# CLOSURE - Revenue Phase 3b: playbooks and the AI Deal Reviewer

## What is true now

A company runs one deal playbook: MEDDICC, BANT, SPICED or its own. Every deal shows a letter per element, on the
deal panel and the Board, in four states (nothing yet, evidence found, noted, validated). "Review with AI" reads the
deal's latest five calls the person can open and stores evidence for each element it can tie to transcript lines, with
links that open the call at the line; elements it can't tie to a line are "not found". A person writes the note; the
deal's rep or their manager validates it; editing un-validates it. Erasure blanks notes and AI reads and keeps that they
existed.

Un-named reliance: the reviewer reads at most 900 lines across five calls; a longer deal history is reviewed on its
latest part.

## Residual

```json
[
  {"id": "R1-review-long-deals", "item": "A deal whose calls run past 900 lines in total is reviewed on the first lines of each of its latest five calls only.", "why_skipped": "The line budget keeps the review inside one model call and its time limit; a per-call summary step would lift it.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T21:06:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
