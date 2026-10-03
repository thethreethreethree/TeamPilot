# BUILD - the KPI job finishes

### One clear and one insert per agent

- **write-path:** `src/app/api/coach/kpi/compute-cron/route.ts`, the per-agent write.
- **read-path:** `compute-cron/__tests__/route.test.ts` "costs ONE delete and ONE insert per agent"; the
  frozen-past-month test (now reading the `.in("period", ...)` filter); "a failed clear skips the insert".
