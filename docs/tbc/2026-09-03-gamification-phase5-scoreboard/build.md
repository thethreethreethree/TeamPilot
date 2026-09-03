# BUILD — Gamification Phase 5 (scoreboard)

### The aggregate (privacy-preserving)
- write-path: `supabase/migrations/0243_gamification_leaderboard_fn.sql` — `gamification_leaderboard(period)`
  security-definer fn, company-scoped, returns per-agent totals + deals only (no per-session rows). One query.
- read-path: any company member gets the board's rank+totals; per-session detail is never exposed (stays in the
  owner+manager ledger).

### The route
- write-path: `src/app/api/coach/gamification/leaderboard/route.ts` — auth-gated, validated period, calls the RPC,
  returns rows + the caller's rank.
- read-path: the UI fetches this and renders the ranked board; a bad period falls back to all-time.

### The UI
- write-path: `src/components/sales-coach/Scoreboard.tsx` + `src/app/dashboard/sales-coach/scoreboard/page.tsx` + a
  "Scoreboard" nav item (Trophy) in `SalesCoachShell.tsx`.
- read-path: the team opens Scoreboard → a clean competitive board (gold/silver/bronze ranks, band chips, deals,
  your-row highlight, emphasized points), with a period selector + honest empty state.

## Files
- `supabase/migrations/0243_gamification_leaderboard_fn.sql` (NEW)
- `src/app/api/coach/gamification/leaderboard/route.ts` (NEW) + `__tests__/route.test.ts` (NEW)
- `src/components/sales-coach/Scoreboard.tsx` (NEW), `src/app/dashboard/sales-coach/scoreboard/page.tsx` (NEW)
- `src/components/sales-coach/SalesCoachShell.tsx` (nav item), `scripts/diag-leaderboard-preview.mjs` (NEW)

## Ripple (§6 item 5)
- New security-definer fn has a pinned search_path (the invariant re-checked — 30/30 in check.md).
- The board reads ONLY aggregates → no privacy regression; the ledger RLS is untouched.
- Nav gains one item; the nav test still passes (16). Presentation restrained per the plan (no XP/levels/confetti).
