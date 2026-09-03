# CHECK — Gamification Phase 5 (scoreboard)

## Migration: `npm run db:apply` → `ALL 30 invariants hold` (the new security-definer fn has a pinned search_path).

## Aggregate preview (live seed): `node scripts/diag-leaderboard-preview.mjs`
```
RANK  AGENT              SESS  TOTAL  AVG   BEST  DEALS
 1    Moses Maniquiz      57   3604  63.2  100   9
 2    Johns Ramos         14    548  39.1   71   0
```
Points-primary sort, real per-agent totals + deals — the board is meaningful.

## Route tests: `npx vitest run .../leaderboard/__tests__/route.test.ts` → 4 passed
(401 unauthenticated; valid period passthrough; invalid period → 'all'; meRank computed / null).

## Nav test: `npx vitest run .../salesCoachShellNav.test.ts` → 16 passed (the added item didn't break nav).

## Typecheck: `npm run typecheck` → clean.

## Visual (AMD-012 — the founder-specified competitive interface)
Rendered the board to a PNG and read it: 🏆 header + period selector; ranked rows with gold/silver/bronze rank
numbers, band chips, sub-line (sessions / avg / best / deals-in-green), the "You" row highlighted, and points
emphasized on the right. Clean, competitive, legible — and restrained (no XP/levels/confetti).

## Findings
- No findings. Privacy holds (aggregates only); the sort matches D4; the design was verified by looking, not asserted.

## Not claimed
- The agent's own points-TREND view (Phase 5 part 3) is not built here (the after-pitch already shows per-session
  detail; a trend chart is a follow-up). Notifications (Phase 4) + calibration (Phase 6) remain.
- The UI ships in code (deploys with the branch); the migration + seed are already live.
