# Company schedule settings — Build

## Built
| path | what | clause |
|------|------|--------|
| `supabase/migrations/0224_companies_schedule_settings.sql` | companies.timezone (text default 'UTC') + workweek_start (smallint default 1, check 0-6). Additive → existing rows keep UTC/Monday. APPLIED (verify:live 27/27). | §1.5.3 |
| `src/lib/schedule/settings.ts` | `getScheduleSettings` (guarded fallback: missing column / thrown query / bad value → UTC/Monday defaults) + `todayInTz` (Intl-based, no dep) + `DEFAULT_SCHEDULE_SETTINGS`. The single settings reader. | §6, §1.5.3 |
| `src/lib/schedule/constraints.ts` | `weekStartOf(date, weekStartDay = 1)` + `weeklyHoursOf(..., weekStartDay = 1)` — parameterized; the default preserves the ISO-Monday behavior so no caller broke. | §2.2, §6 |
| `src/lib/schedule/authority.ts` + `evalContext.ts` + `resolution.ts` | EvalContext gains `weekStartDay?`; buildEvalContext accepts + sets it; the hours-cap (assign/swap) + fair-load ranking read `ctx.weekStartDay ?? 1`. | §2.2 |
| `src/app/api/schedule/settings/route.ts` | GET (settings for any authed user) + PATCH (manager-only, IANA-validated, workweek 0-6, company_id pinned to the session — INV15). | §1.5.1 |
| `src/app/api/schedule/coverage/route.ts` + `timeoff/route.ts` + `timeoff/evaluate/route.ts` | Consume settings: server "today" = `todayInTz(tz)`; the eval context is built with `weekStartDay`. | §2.2, §6 |
| `src/app/dashboard/schedule/settings/page.tsx` + `components/schedule/ScheduleNav.tsx` | A Settings tab + page: timezone picker (Intl.supportedValuesOf) + workweek-start select; GET on mount, PATCH on save; savingRef latch. | §1.5.1 |
| `src/app/dashboard/schedule/grid/page.tsx` | Fetches settings; the default week + "This week" use `weekStartOf(todayInTz(tz), workweekStart)`; a ref guard sets the initial week ONCE (a reload can't yank the manager off a navigated week). | §1.5.1 |
| tests | `settings.test.ts` (reader fallbacks + todayInTz), `settings/route.test.ts` (GET/PATCH auth + INV15 pin + validation), `constraints.test.ts` (weekStartOf per weekStartDay — DETECTION-PROVEN). | A30 |

## Features (reachability inventory)

### Company timezone + workweek-start settings
A manager sets the company timezone + the day the workweek starts; the schedule's date math honors them.
- write-path: Settings page → PATCH /api/schedule/settings (manager-only, IANA + 0-6 validated) → companies
  row updated, company_id pinned to the session (INV15; companies UPDATE RLS scopes to auth_company_id()).
  human_can_set: YES (Settings tab).
- read-path: `getScheduleSettings` reads the row (guarded fallback to defaults). The coverage + time-off
  routes compute "today" via `todayInTz`; the hours-cap week + the grid week bucket on `workweekStart`. The
  grid's Settings-driven week is visible immediately (the columns realign to the workweek-start).

### Guarded, migration-safe reader
The date math is correct whether or not 0224 is applied, and never crashes a schedule read.
- write-path: n/a (a read helper). human_can_set: the values it reads come from the Settings PATCH above.
- read-path: `getScheduleSettings` returns the row's values when present-and-valid, else the UTC/Monday
  defaults — on a missing column (migration pending), a thrown/rejected query, OR an out-of-range value. Every
  route consumer therefore degrades gracefully instead of 500-ing on a settings hiccup.

## Step 7 — Reachability (A31)
Both features are human-reachable now: a manager opens Settings, sets the values, and the grid + server date
math reflect them. Migration 0224 is APPLIED (not code-only). weekStartOf's configurable behavior is
detection-proven; the reader fallbacks + the route auth are unit-tested.
