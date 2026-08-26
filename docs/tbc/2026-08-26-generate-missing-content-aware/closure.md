# CLOSURE — P1: content-aware "Generate missing" (exclude empty captures)

## What shipped
"Generate missing" is now content-aware. A session with zero transcript segments (an empty capture — the iOS bug's
downstream) is no longer counted as a recoverable "missing dissect" or fed to the batch; it is reported honestly as
`noContent`. So the manager's "remaining" reflects the true recoverable count (25 / 41 for the two active companies),
each click generates up to 4 real assessments (progress that drains to 0), and the empty sessions are surfaced as
"N sessions had no audio captured" instead of a stuck, un-generatable backlog. Diagnosed from the real segment-count
data, not assumed.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). +2 backfill tests; 9 existing pass.

## The un-named reliance
- **`getSessionTranscriptAdmin` and the content check read the SAME `coaching_transcript_segments` table**, so a
  0-segment session is the same "empty" the dissect engine would see. Verified by reading the function. If the dissect
  ever sourced its transcript elsewhere, the content check would diverge — pinned by the shared-table read.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The recoverable 25/41 sessions are not auto-generated — the manager clicks 'Generate missing' (4/click, ~7-11 clicks) to drain them.",
    "why_skipped": "Auto-running 66 sessions × 5 engines is a real LLM-cost burst that is the founder's call, not a silent side effect of a bug-fix. The button now WORKS (each click makes progress), which is the reported problem; bulk-generation can be a follow-up if the founder wants it (raise the cap, or a one-shot drain).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-26T09:40:00+08:00",
    "outcome": "OPENED + bounded: the P1 complaint was 'won't generate' — now each click generates the recoverable batch and reports honestly, so the button is fixed. Whether to bulk-drain the ~66 recoverable is a cost decision surfaced to the founder, not assumed."
  },
  {
    "id": "R2",
    "item": "The initial page (before clicking) still shows reps by dissectCount; it does not yet show a company-level 'X recoverable / Y no-audio' summary.",
    "why_skipped": "The post-click message now carries the honest counts, which resolves the immediate confusion. A persistent header summary is a UX nicety, not the reported bug; deferred to avoid scope-creep on the 5h P1.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
