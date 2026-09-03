# BUILD — Gamification Phase 1 (data model)

### The tables
- write-path: `supabase/migrations/0242_gamification_points_ledger.sql` — `agent_point_ledger` (append-only, raising
  immutability trigger, unique session_score-per-session, company-scoped owner+manager RLS, service-role writes) and
  `manager_notifications` (two types, recipient-dedupe unique index, recipient-only RLS).
- read-path: service-role code (Phase 2/3) banks a session's derived points once; a manager reads only their own
  notifications; the owner/manager reads ledger detail; peers do not (privacy holds).

### The constants + types
- write-path: `src/lib/coach/gamification/rubric.ts` — RUBRIC_VERSION, POINTS_DIMENSIONS (reuse existing ScoreKeys),
  POINTS_SCALE_MAX=100, STRONG_SESSION_THRESHOLD=80, contiguous BANDS, row types (AgentPointLedgerRow,
  ManagerNotification). No logic — Phase 2 imports these.
- read-path: Phase 2's mapping + Phase 4's alert threshold read these single-source constants (no scattered literals).

## Files
- `supabase/migrations/0242_gamification_points_ledger.sql` (NEW)
- `src/lib/coach/gamification/rubric.ts` (NEW) + `__tests__/rubric.test.ts` (NEW)
- `scripts/verify-gamification-ledger.mjs` (NEW — rolled-back behavioral proof)
- `docs/gamification/FINDINGS.md`, `docs/gamification/DECISIONS.md` (Phase 0 output + resolved decisions)
- `scripts/diag-gamification-distribution.mjs`, `diag-existing-scores.mjs`, `diag-score-dimensions.mjs` (Phase-0 live evidence)

## Ripple (§6 item 5)
- Two NEW company_id tables → both RLS-on + company-scoped (the tenant-isolation invariant held — 30/30 in check.md).
- No change to existing scoring / after_pitch / KPI — points DERIVE from the existing scores (Phase 2), nothing edited.
- The append-only trigger blocks DELETE for service-role too — deliberate (a ledger is permanent); tests use rollback.
- Leaderboard aggregate VIEW (company-wide rank+totals, no per-session detail) is NOTED for Phase 5, NOT built here.

## Out of scope (per the plan's Phase 1)
No judge, no points-mapping logic, no API route, no UI, no cron/trigger that calls scoring, no notification writes.
