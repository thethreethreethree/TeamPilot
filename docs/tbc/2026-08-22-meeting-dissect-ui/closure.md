# CLOSURE — Meeting Dissect review UI (Phase-6 complete end-to-end)

## What shipped
`MeetingReview` + a review page — the human-facing post-meeting Dissect. Renders decisions / owned-actions
(owner-less flagged) / open items / effectiveness / overall, with honest analyzing/pending/error/empty states.
Theme-legible. **With this, the Dissect is complete end-to-end: measurement core → store → route → UI.** Client
component + page; full `npm run check` exit 0 (3588 tests); no sales/server change.

## The un-named reliance
- **Device confirmation.** Fetch/render React glue — confirmed on a real run, like the panel.
- **A path to reach it.** The review page is at `/dashboard/meeting-coach/[id]/review`; wiring a "review this
  meeting" link from a meetings list / the panel's post-Stop flow is a small follow-up (nav is founder-gated).

## Open (final Dissect piece + the standing gated items)
1. The per-team improvement-TREND aggregate over `meeting.dissect_generated` events (no control baseline — audit).
2. A meetings list / post-Stop link to reach the review (ties to nav placement — founder-gated).
3. RLS: the review currently owner-gates at the ROUTE; if managers should see team meeting reviews, revisit the
   coaching_cues/events read visibility (audit Layer-3 flag).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "auto-generate-on-first-view",
    "item": "The review auto-POSTs (fetch-or-generate) on mount, so the FIRST view of a never-reviewed meeting triggers a batch STT charge without an explicit 'generate' click.",
    "why_skipped": "The stored-event cache means only the very first view charges; every later view is free. An explicit gate would add a click for no cost saving after the first, and the facilitator opening the review IS the intent to review.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T01:14:00+08:00",
    "outcome": "Examined the cost: first-view-only STT, then cached forever. Matches the sales after-pitch auto-recover-on-view pattern (opening the review is the consent). If STT cost per meeting becomes a concern, gate the first generate behind a button — a one-line change in MeetingReview. Left auto for the smoother MVP flow."
  }
]
```
