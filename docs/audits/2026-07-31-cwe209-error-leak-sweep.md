# Audit — CWE-209 raw-DB-error leak sweep (app-wide, 2026-07-31)

**Lens:** `reference_public_api_raw_error_leak_and_sweep_recipe`. A route that returns `error.message` (a raw
Supabase/Postgres error) to the client can disclose schema, column names, RLS/FK details. **Fix pattern:** log
server-side (`console.error`), return a generic client message. The migration-pending 409/`degraded` branches
that carry curated, useful text are NOT leaks and stay.

This audit was triggered while writing tests for the KPI quota route (which leaked). The sweep then ran across
the whole `src/app/api` surface. Recipe: `grep -nE 'NextResponse\.json\(\s*\{\s*error:\s*[a-zA-Z_]+\.message'`
then classify each hit by hand (status code + who calls it).

## Classification

### A. FIXED this session (customer-facing 500 leaks)
- `coach/sales-session/quota` (GET+PATCH) — `6559ff20`
- `coach/sales-session/recordings` (non-missing-column + fallback-window) — `d1449314`
- `coach/sales-session/[id]/save-recording` — `d1449314`
- `me/theme` (×2), `me/care-notifications` (GET+PATCH), `me/learning-mode`, `me/experience-mode` — `c474b084`

### B. INTENTIONAL — leave as-is (verified, not leaks)
- **Finance domain errors** (`finance/*` at status **403/400**) — deliberate, actionable domain messages
  ("period is closed", "unbalanced", RLS-denied) to a trusted CFO/operator. The A15 "close without a fix"
  pattern. Routes: roles, reports, reports/schedules, delegations, rates, budgets, contractors, cards,
  expense-policies, close-year, periods, expenses/reports/[id], cards/[id]/automatch+import.
- **LlmError surface** (`coach/v5/*`, `coach/analyze`, `sales-session/decision-dialogue`) — `{error: err.message,
  kind}` where `err` is a curated LlmError, not a DB error.
- **Upload validation** (`coach/sales-session/extract`, `care/agent/acms/extract` at **415/422**) —
  `UnsupportedFormatError` / `EmptyExtractionError` friendly messages; the parser-throw path already logs+generic.
- **C.A.R.E public surfaces** — already swept 2026-07-27 (create-conversation, post-message, widget upload).
- **Scheduler-only crons** (e.g. `coach/sales-session/recording-purge-cron`) — response seen only by the
  CRON_SECRET caller, not a customer; low-value to change.

### C. OPEN — customer-facing 500 leaks in core product routes (needs founder greenlight to sweep)
These are the same class as (A) but in broader product areas — a member can hit a raw DB error. A fix is
low-risk *per route* (identical log+generic swap, success paths unchanged) but spans many product surfaces, so
it's a reviewable initiative rather than a unilateral mass-edit:

| Route | Sites | Caller |
|---|---|---|
| `tasks` | 4 | member |
| `problems` | 3 (incl. linkErr) | member |
| `resolutions` | 1 | member |
| `decisions` | 1 (decisionErr) | member |
| `notifications`, `notifications/subscribe` | 3 | member |
| `team` | 3 | member/admin |
| `settings` | 1 | member |
| `files/search`, `files/[id]/access` | 2 | member |
| `admin/team-check`, `admin/coach-readout` | 3 | trusted operator (lower risk) |

## Recommendation
Greenlight a single focused sweep of section **C** (member-facing first: tasks, problems, resolutions,
decisions, notifications, team, settings, files). Each is the same mechanical fix + a light regression test on
one representative route (assert a thrown DB error yields a generic 500 with no raw string). Admin/* is lowest
priority (trusted operator). Estimated small-to-medium; low behavioural risk (only 500 error strings change).

## How to verify a fix (per route)
Inject a DB error with a sentinel string in a route test, assert the response body is the generic message and
`JSON.stringify(body)` does NOT contain the sentinel — the pattern used for the quota route
(`sales-session/quota/__tests__/route.test.ts`).
