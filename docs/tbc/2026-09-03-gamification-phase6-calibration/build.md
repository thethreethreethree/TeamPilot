# BUILD — Gamification Phase 6 (calibration tool)

### The store (append-only, manager-read, anonymized-by-omission)
- write-path: `supabase/migrations/0244_gamification_calibration.sql` — `gamification_calibration` (company + session
  + scorer + jsonb scores), append-only, unique (scorer_id, session_id). Manager-read RLS; NO client write policy —
  writes go service-role through the route after an auth+manager check.
- read-path: a manager sees their own blind scores aggregated into the report; the raw rows never expose a rep name
  (the table stores scores, not identities beyond the session ref).

### The pure comparison
- write-path: `src/lib/coach/gamification/calibration.ts` — `computeCalibration(pairs)` → per-dimension meanAbsDiff,
  trustworthy (<= 1.5), worstDisagreements (top 5), overallTrustworthy (null when no data). JUDGED_DIMENSIONS =
  opener/objection/tone/close/next_step (computed dims excluded).
- read-path: the route + UI render this report; the verdict is null, not fabricated, until there is data.

### The route (blind-then-reveal)
- write-path: `src/app/api/coach/gamification/calibration/route.ts` — GET returns the report + the NEXT transcript
  ANONYMIZED (REP/PROSPECT, no name), model scores withheld; POST stores the blind score then reveals the model's
  judged scores. Service-role, manager-gated (ctx.isAdmin OR sales_coach_role='admin').
- read-path: the UI fetches GET on load, POSTs the manager's sliders, and shows you-vs-AI + the running report.

### The UI
- write-path: `src/components/sales-coach/CalibrationTool.tsx` + `src/app/dashboard/sales-coach/calibration/page.tsx`
  + a "Score Calibration" nav item (Scale, managerOnly) in `SalesCoachShell.tsx`.
- read-path: manager opens Score Calibration → reads an anonymized transcript, scores five sliders blind, submits,
  sees the reveal (you N / AI M / ±diff) + a per-dimension agreement report with a trustworthy/needs-a-look banner.

## Files
- `supabase/migrations/0244_gamification_calibration.sql` (NEW — written, not yet applied; network down)
- `src/lib/coach/gamification/calibration.ts` (NEW) + `__tests__/calibration.test.ts` (NEW)
- `src/app/api/coach/gamification/calibration/route.ts` (NEW) + `__tests__/route.test.ts` (NEW)
- `src/components/sales-coach/CalibrationTool.tsx` (NEW), `src/app/dashboard/sales-coach/calibration/page.tsx` (NEW)
- `src/components/sales-coach/SalesCoachShell.tsx` (Scale import + nav item)

## Ripple (§6 item 5)
- New table has manager-read RLS + no client write policy → no privacy/tenant regression; the ledger is untouched.
- Anonymization lives in the route's transcript builder (speaker-role only) — the one place the rep's name could
  have leaked; a route test asserts REP/PROSPECT and no name.
- Nav gains one managerOnly item; the nav test still passes (16).
- Migration 0244 is UNAPPLIED (network down) → the route + UI ship in code but the table must exist before the
  feature works live; db:apply is a named pending step (check.md), surfaced not hidden (§1.5.3 / A38).
