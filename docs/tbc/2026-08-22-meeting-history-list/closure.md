# CLOSURE — Meeting history list

## What shipped
`GET /api/coach/meeting-session` (facilitator's meeting/huddle sessions) + `MeetingHistoryList` on the setup
view — recent meetings each linking to their review. With this, review is reachable for the just-ended meeting
(post-Stop link) AND past meetings (this list), and the aggregate is on the trend tile. Client + a GET handler;
full `npm run check` exit 0 (3600 tests); no sales/server change.

## The un-named reliance
- **Device confirmation** for the list render (null-on-failure, so worst case is an absent list).
- **The kind filter.** A sales session must never appear in the meeting list — pinned by a GET test.

## Open
1. Nav placement / where the meeting-coach surface lives (founder-gated, Team-Sync).
2. Founder sign-off on the proposed dissect measurement + trend heuristic.

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "list-scoped-to-self",
    "item": "The history list shows only the facilitator's OWN meetings (listAgentSessions by agent_id), not the team's.",
    "why_skipped": "A facilitator reviews their own meetings; a manager's team-wide view is a separate manager surface (like the sales coach-assessment), and the team-level improvement signal is already the trend tile (company-scoped).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T02:38:00+08:00",
    "outcome": "Examined the two audiences: the facilitator (own meetings — this list) and the manager (team view — a future manager surface, matching the sales pattern where coach-assessment is manager-only). The company-scoped TREND tile already gives the team-level signal. Per-facilitator self-scope here is the correct default; a manager team-list is a later, separately-gated surface."
  }
]
```
