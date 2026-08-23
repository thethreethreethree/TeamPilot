# CLOSURE — pending-audio review hard auto-terminal (audit D5)

## What shipped
The last flagged D5 item, built as an **A20 defensible default** (I had wrongly been offloading it as "a founder
UX call" — the exact A20 failure). `MeetingReview` now counts consecutive 409s and, after `MAX_PENDING_RETRIES`
(3), shows a hard "no-recording" terminal (states the truth, drops Try-again, keeps Back) instead of offering
Try-again forever. Safe because a review-time 409 is terminal-dominant (chunks upload during the call); the
counter resets on any non-409 result so a recoverable review is never prematurely terminated; a fresh navigation
remounts + resets, so a late-landing recording can still be re-checked. +2 detection tests; client-only; no
route/server/schema change; `npm run check` EXIT 0.

## The un-named reliance
- Correctness relies on the counter incrementing ONLY on 409 and resetting on EVERY non-409 branch (ready +
  non-409 error + network catch) — both pinned by the "recovery resets" test.
- The threshold-3 safety relies on chunks uploading during the call (so a review-time 409 is terminal-dominant),
  established by INT-1 (dissect stitches on-demand + finds no chunks). The remount-resets escape is the fallback
  for the rare late-upload.

## Residual (A36)

```json
[
  {
    "id": "auto-terminal-threshold-tuning",
    "item": "MAX_PENDING_RETRIES is a default of 3 and the terminal copy is a default. If real-world stitch/upload timing ever pushes a legit recording past 3 review-time retries, a rep could see a premature 'not recorded' (mitigated: a fresh navigation remounts + resets, so it's re-checkable, not permanent).",
    "why_skipped": "3 is a safe default given chunks upload DURING the call (a review-time 409 is terminal-dominant); tuning the exact number/copy is a low-stakes founder preference, not a correctness gap.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T13:00:00+08:00",
    "outcome": "Shipped the default (A20); founder can adjust the threshold/copy."
  },
  {
    "id": "remaining-backlog-genuinely-founder-gated",
    "item": "Still not built (validated as not-cleanly-buildable-unattended): D3 (coverage race — benign monotonic + needs a founder-applied migration/row-lock), D4 (multi-company assertions — founder EXPLICITLY deferred to that milestone), device validation (founder-side).",
    "why_skipped": "D3 = gold-plating (benign + migration-gated); D4 = respecting the founder's explicit deferral (§3.3, not an A20 offload); device = physically founder-side.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T13:00:00+08:00",
    "outcome": "Flagged; each needs a founder decision/action (see docs/SESSION-HANDOFF-2026-08-23.md)."
  }
]
```
