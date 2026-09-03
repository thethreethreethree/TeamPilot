# CHECK — Gamification: agent points-trend view

## Tests: `npx vitest run src/app/api/coach/gamification/my-points/` → 3 passed
(401 unauthenticated; total/avg/band shape from detail; empty history → zeros not an error).

## Typecheck: `npm run typecheck` → clean (exit 0).

## Visual (AMD-012): the "Your progress" card rendered to a PNG and read — summary (total/avg/sessions), a clean
points-per-session sparkline with the last point marked + a faint 0–100 frame, and a recent-sessions list with
band + points. Restrained + legible.

## Findings
- No findings. Private (owner-RLS), reuses the after-pitch detail, honest empty (renders nothing with no points).

## Not claimed
- The component's live behavior (fetch + sparkline scaling) is founder-visual-verify in the app; the route is
  unit-tested + the design rendered here. Ships in code (deploys with the branch).
