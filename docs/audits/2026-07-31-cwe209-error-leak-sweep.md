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

### C. SWEPT 2026-07-31 (complete) — customer/member-facing 500 leaks in core product routes
Done one route per commit, each fix + verify (tasks/problems also got regression tests; the pattern is locked
by ≥8 representative tests). All log server-side + return a generic message; success/authz/404 paths unchanged.

| Route | Sites | Commit |
|---|---|---|
| `tasks` | 4 (+test) | `2f80f10b` |
| `problems` | 3 — gate-hold 422 preserved (+test) | `9060c3a2` |
| `resolutions` + `decisions` | 1 + 2 (incl. interpolated) | `82494bc8` |
| `notifications` + `subscribe` | 3 | `a2e5b122` |
| `team` | 4 | `686a3ca0` |
| `settings` | 2 | `d5605f2d` |
| `files/search` + `files/[id]/access` | 4 | `8e1b294d` |
| `admin/coach-readout` + `admin/team-check` | 5 | `571243e7` |
| **re-run catches** (A38): `diagnosis/close`, `feedback` (GET+POST), `seed` | 4 | `328116f5` |

### D. Re-run verification (A38)
After the sweep, re-ran `grep -rnE "error:\s*[a-zA-Z_]+\.message"` over `src/app/api` and classified EVERY
remaining hit. All remaining are intentional: `instanceof LlmError` surfaces ({error,kind,provider}), 415/422
upload validation (`UnsupportedFormatError`/`EmptyExtractionError`), finance domain 403/400, the problems
gate-hold 422, and the `pilot/redeem` + `team/accept` 422s (RPCs raise human-readable domain messages,
documented safe to show). The scheduler-only `recording-purge-cron` 500 is not customer-facing (left).

**Status: the `error: X.message` direct-return class is complete.** No known customer/member-facing raw-DB-error
leak of that shape remains.

### E. OPEN follow-up — the catch-block fallback pattern (needs a careful, reviewed sweep)
A DISTINCT pattern the section-A–D grep did not target: `catch (err) { ... err instanceof Error ? err.message
: "fallback" ... }`. Found while testing `diagnosis/close` (whose catch leaked via the two-step `const message =
err.message; return {error: message}` form — fixed + tested in `480a8e13`). A re-grep for `instanceof Error ?
X.message` surfaces **~40+ sites** across AI/streaming/care/coach/finance/chat routes.

**Why this is a SEPARATE, greenlit initiative — not a same-turn mass-edit:** unlike the unambiguous section-C
DB-error returns, each catch-block site needs individual classification:
- Some are the **LlmError fallback** — the route already did `if (err instanceof LlmError) return {curated}`, so
  the catch-all only fires for a genuine unexpected error → a real (if rare) leak.
- Some compute `const detail = ... String(err)` used for **server logging**, not the client response → not a leak.
- Some are `send("error", {...})` inside a **stream** → client-facing, same care needed.
- Some pass `p_detail` to an **RPC audit log** (e.g. finance deliver-cron) → not a client leak.

Mass-editing 40+ files across every subsystem in one pass risks both missed nuances (leaving a leak) and broken
error surfaces (regressions) — the "make sure it doesn't break our system" constraint. RECOMMENDATION: sweep
this as its own reviewed pass, per-subsystem, classifying each site (client-response vs logging-detail vs
stream-send), with a light regression test per representative route. `diagnosis/close` (`480a8e13`) is the
template. Estimated medium; higher per-site judgement than section C.

## How to verify a fix (per route)
Inject a DB error with a sentinel string in a route test, assert the response body is the generic message and
`JSON.stringify(body)` does NOT contain the sentinel — the pattern used for the quota route
(`sales-session/quota/__tests__/route.test.ts`).
