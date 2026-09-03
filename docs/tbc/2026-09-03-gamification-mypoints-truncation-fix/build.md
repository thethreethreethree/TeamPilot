# BUILD — my-points summary truncation fix

### The read (now full-history, owner-scoped, paged)
- write-path: `src/app/api/coach/gamification/my-points/route.ts` — replaced `.limit(200)` with `fetchAllPagedResult`
  over the owner-scoped (agent_id = caller, reason = session_score) read; compute total/avg/sessions over the FULL
  set; return only the most-recent 200 rows (`all.slice(-TREND_WINDOW)`) for the trend payload.
- read-path: MyProgress shows total/avg/sessions that now MATCH the leaderboard's SUM for the same rep; the trend
  chart draws the recent window.

## Files
- `src/app/api/coach/gamification/my-points/route.ts` (fix)
- `src/app/api/coach/gamification/my-points/__tests__/route.test.ts` (+1 test; mock gains `.range`)

## Ripple (§6 item 5)
- Owner-scoping unchanged (the eq(agent_id) + eq(reason) survive into every page) → no privacy/tenant change.
- fetchAllPagedResult FAILS HONESTLY (throws → {data:null,error}) so a truncated set can't masquerade as complete;
  the route already 500s on error.
- Payload bounded to 200 trend rows regardless of history size → no unbounded response growth.
- The leaderboard/notifications/calibration routes were audited alongside and needed no change.
