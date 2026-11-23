# REMEDIATE - Deal risk and forecast

### F1 - the thresholds are product choices, not measured
Stated on the Forecast view; one constant each.
gate-or-promise: promise (OPEN.md "deal-risk thresholds unmeasured" — compare against which flagged deals were lost once enough have closed, §4)

### F2 - the Ask box does not know a deal's risk
gate-or-promise: promise (OPEN.md "Ask box: add each deal's risk reasons to its context")

## Addendum 2026-11-23 — F2 fixed
The Ask box's pipeline context now carries each deal's risk line from the same dealRisk() (buildPipelineContext, with
the viewer's calendar day sent by the Pipeline screen). Test: askPipeline.test.ts "buildPipelineContext risk line".
gate-or-promise: gate (src/lib/coach/remote/__tests__/askPipeline.test.ts)
