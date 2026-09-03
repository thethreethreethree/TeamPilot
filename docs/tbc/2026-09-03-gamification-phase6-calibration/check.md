# CHECK — Gamification Phase 6 (calibration tool)

## Migration: PENDING — NOT applied this session (honest, A38 / §1.5.3)
`npm run db:apply` could NOT run — the network is down (Supabase pooler unreachable, same outage blocking git push).
`supabase/migrations/0244_gamification_calibration.sql` is written and reviewed (append-only, unique (scorer_id,
session_id), manager-read RLS, no client write policy). It MUST be applied before the feature works live. This is a
named blocking step, not a claim of completion.

## Pure-logic tests: `npx vitest run src/lib/coach/gamification/__tests__/calibration.test.ts` → 6 passed
Perfect agreement → 0 diff / trustworthy; a dimension over 1.5 → flagged untrustworthy; a diff exactly 1.5 → still
trustworthy (<=); a dimension counts only when BOTH sides scored it; worst disagreements surface largest-first;
empty input → overallTrustworthy null (never a fabricated verdict).

## Route tests: `npx vitest run .../calibration/__tests__/route.test.ts` → 4 passed
403 unauthenticated; 403 for a non-admin without sales_coach_role='admin'; GET anonymizes the next transcript
(REP/PROSPECT, never a rep name) and reports agreement; POST stores the blind score and reveals the model's scores.

## Nav test: `npx vitest run .../salesCoachShellNav.test.ts` → 16 passed (the managerOnly item didn't break nav).

## Typecheck: `npm run typecheck` → clean (Scale imported; no unused symbols).

## Visual
Rendered the tool to a PNG and read it: "Score calibration" header + progress ("6 of ~20"); a report card with a
trustworthy/needs-a-look banner and per-dimension ±diff (green under 1.5, amber ⚠ over); an anonymized transcript
(REP/PROSPECT); five blind sliders; "Submit & compare". Clean, legible, and the privacy model is visible in the
surface (no names).

## Findings
- No findings in the built code. The one open item is operational, not a defect: migration 0244 must be applied
  (blocked by the network outage), and the actual calibration run (hand-scoring transcripts) is founder work.

## Not claimed
- db:apply did NOT run (network down) — the table is not live yet.
- Nothing pushed (same outage) — the commit is local until the network returns.
- Auto-suppressing a failing dimension from the leaderboard is NOT built (a future gate once real calibration data
  exists); Phase 6 measures + surfaces trust, it does not yet act on it.
