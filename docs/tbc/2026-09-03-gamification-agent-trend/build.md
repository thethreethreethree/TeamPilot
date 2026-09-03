# BUILD — Gamification: agent points-trend view

### The route
- write-path: `src/app/api/coach/gamification/my-points/route.ts` — the caller's own session_score ledger rows
  (points + band + session link) + total/avg. Owner-RLS read (agent_id = auth.uid()).
- read-path: the rep's private progress data; never another rep's.

### The component
- write-path: `src/components/sales-coach/MyProgress.tsx` — summary + a restrained points-per-session sparkline +
  recent sessions linking to their after-pitch. Placed above the board on the scoreboard page (Scoreboard.tsx).
- read-path: a rep sees their total/avg, a trend line, and can tap a session to open its (private) breakdown.

## Files
- `src/app/api/coach/gamification/my-points/route.ts` (NEW) + `__tests__/route.test.ts` (NEW)
- `src/components/sales-coach/MyProgress.tsx` (NEW), `src/components/sales-coach/Scoreboard.tsx` (placement)

## Ripple (§6 item 5)
- No schema change; reads the existing ledger via owner-RLS. Reuses the after-pitch as the detail view.
- Restrained dataviz (one accent line, no gridlines/gradients/legends) consistent with the plan's presentation restraint.
