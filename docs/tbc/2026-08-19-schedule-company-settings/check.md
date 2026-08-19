# Company schedule settings — Check

Proactive four-layer self-audit (§1.5.2) of the just-built path.

### Finding: the settings read handled a returned error but not a THROWN query
class: a non-critical config/settings read whose failure path only covered the `{ error }` return shape, not a
thrown/rejected query (a client that can't perform the call, a network throw). The unguarded throw bubbled out
of `getScheduleSettings` into the route's Promise.all and 500'd the WHOLE schedule read (coverage / time-off)
over a settings lookup. The class is "a supporting read whose failure escalates to the primary read's failure
because only one of its two failure shapes (returned-error vs thrown) is handled."

sweep: `grep -rn "getScheduleSettings" src/app src/lib/schedule` — every caller is inside a read route's
Promise.all; the try/catch now inside getScheduleSettings makes ALL of them degrade to defaults on any
settings failure, so no schedule read 500s over settings. Surfaced concretely by the route tests
("maybeSingle is not a function" → 500) before the guard was added.

severity: medium (a transient settings-read failure would have taken down the coverage + time-off reads — real
availability impact — until the guard).

## Verification
`npm run check` — output + exit code in closure.md (A38). Migration 0224 applied via `npm run db:apply`,
verify:live 27/27. weekStartOf's per-day behavior DETECTION-PROVEN (reverting the param → the workweek-start
test fails; restored → passes). +12 tests.

No other findings: the companies UPDATE RLS was READ and confirmed to permit the manager's write (id =
auth_company_id(), the 0201 default_theme precedent — §1.5.3 satisfied, not assumed); weekStartOf keeps its
Monday default so no caller broke (§2.2/§6); the grid sets its initial week once (ref-guarded) so a reload
can't jump off a navigated week; Intl.supportedValuesOf is guarded for older runtimes.
