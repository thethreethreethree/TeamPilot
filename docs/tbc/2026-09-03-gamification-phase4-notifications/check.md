# CHECK — Gamification Phase 4 (manager notifications)

## Tests: `npx vitest run src/lib/coach/gamification/ generateAndStoreAfterPitch.test.ts src/app/api/coach/gamification/`
```
 Test Files  6 passed (6)
      Tests  31 passed (31)
```
Includes: notify fan-out to managers excluding the agent; idempotent upsert (onConflict recipient_id,type,session_id,
ignoreDuplicates); no-managers → no upsert; best-effort swallow of a DB error; the wire drift-guard (a strong
banked session fires notifyStrongSession with the points, a sub-threshold one does not); the leaderboard route.

## Typecheck: `npm run typecheck` → clean (exit 0).

## Findings
- No findings. Alerts fire only on real events, fan out to the right recipients, are idempotent, and neither wire
  can break its host flow (best-effort). Mark-read is caller-pinned.

## Not claimed
- The bell UI (badge/list/mark-read) is founder-visual-verify in the running app; the notify logic + routes are
  unit-tested here. Placed on the Scoreboard (manager-only) rather than the global shell header (a low-risk
  placement chosen over editing the complex shell layout mid-session — see closure residual).
- The routes/UI ship in code (deploy with the branch); the tables are already live (0242).
