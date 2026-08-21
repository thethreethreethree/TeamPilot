# CLOSURE — Meeting trend tile

## What shipped
`MeetingTrendTile` on the meeting-coach setup view — the §3.6 make-learning-visible surface for the team's
meeting-improvement trend (direction + quality ratios), honest "insufficient", silent-on-failure. With this the
Phase-6 Dissect is visible end-to-end: per-meeting review + the team trend. Client-only; full `npm run check`
exit 0 (3598 tests); no sales/server change.

## The un-named reliance
- **Device confirmation** for the fetch/render glue (renders null on failure, so worst case is an absent tile).
- **A path to the per-meeting REVIEW.** The trend is now on-surface; a "review this meeting" link from a meetings
  list / the post-Stop flow is the remaining reach (ties to nav — founder-gated).

## Open
1. A meetings list + a "review" link to reach `/dashboard/meeting-coach/[id]/review` (nav — founder-gated).
2. Founder sign-off on the proposed consequence measurement + the trend direction heuristic (both PROPOSED).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "tile-fetches-on-every-setup-open",
    "item": "The tile fetches GET /trend every time the setup view mounts (each time the facilitator opens the meeting coach or ends a meeting back to setup).",
    "why_skipped": "The trend route is a cheap aggregate read (no STT/LLM — just an events query + pure math), so re-fetching on mount is inexpensive; it also keeps the trend fresh after a new meeting is reviewed.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T01:26:00+08:00",
    "outcome": "Examined the cost: GET /trend is an indexed events read + O(n) math over <=200 rows, no external call — cheap. Re-fetching on mount trades a trivial query for always-fresh numbers; caching would add staleness for no meaningful saving. Left as-is."
  }
]
```
