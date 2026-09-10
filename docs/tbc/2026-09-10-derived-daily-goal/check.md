# CHECK - the daily sales goal decides itself

## Findings

### F1 - the screen that answers "how many doors today" was answering "ask your manager"
class: a-feature-gated-on-data-nobody-ever-enters
sweep: read rep_daily_sales_goal, companies.sales_coach_monthly_deal_target and the outcome counts on production before designing anything
severity: high
Doc 06 specified a manager-set daily goal, and the screen correctly refused to invent a target without
one. But `rep_daily_sales_goal` has ZERO rows, so every rep in the company opens the door tracker to an
empty panel. The feature was complete and delivered nothing - the layer-2 failure §1.5.1 names, every test agreed with it while not one rep could use it. Fixed by deriving the goal; see remediate.md.

### F2 - I read the wrong table and nearly designed around a fact that was not true
class: measured-the-neighbouring-column
sweep: service-role counts on coaching_sessions.outcome AND door_knocks.outcome, plus companies.sales_coach_monthly_deal_target
severity: medium
Deriving from past sales and dividing a company quota are the two answers reasoning reaches for, so both
were measured before designing. The quota is genuinely null. The sales were not: I counted
`coaching_sessions.outcome` (0 of 73) and concluded there were no sales in the business, when the door
funnel records its result on `door_knocks.outcome` - which the day-target engine already reads, and which
holds 38 sales.

Caught by opening the residual that said this did not matter, which is precisely the entry A36 says to
open first. Had it stood, this build's own record would have claimed the own-sales basis was unreachable,
and a future reader would have designed around a premise that was false. The DERIVATION is unaffected -
it always counted door_knocks, because it reuses the engine's own query - so no code changed; the record
did.

## What was NOT changed, on purpose
The manager's row still wins wherever one exists, and the RLS making that table manager-write is
untouched. Deriving is the fallback. The frozen row is still never recomputed intra-day.

## Mutation proof (A30)
```
$ npx vitest run src/lib/coach/doorlog
      Tests  101 passed (101)
$ # the behaviour change is pinned by two REWRITTEN tests: before this build
$ # "no manager goal -> empty state" passed, and it was the thing to change.
```

## Targeted suite
```
$ npx vitest run src/lib/coach/doorlog src/app/api/coach/doorlog
 Test Files  18 passed (18)
      Tests  106 passed (106)
EXIT=0
```

## Canonical command
```
$ TBC_BUILD=2026-09-10-derived-daily-goal npm run check
  typecheck | lint | theme:audit | rls:audit | invariant:audit | tbc | test
  theme:audit      - No theme-bound leaks. (1645 files scanned)
  rls:audit        - Tables without RLS: 0
  invariant:audit  - Files scanned: 1013 | Violations: 0
  tbc:docs OK  tbc:manifest OK  tbc:artifacts OK  tbc:residual OK  tbc:freshness OK
  Test Files  635 passed | 1 skipped (636)
       Tests  4198 passed | 15 skipped (4213)
EXIT_CHECK=0
```

## Still to verify
The rep's screen with a real derived goal. The derivation is proven by tests and the production data was
read directly, but nobody has yet opened the app against a deployment of this and seen dials instead of
the empty panel.
