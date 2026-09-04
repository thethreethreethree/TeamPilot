# BUILD - doorlog honours the caller's own RLS client

### The caller's client reaches the data layer
- write-path: `src/lib/data/doorlog.ts` - `createKnock`, `createPitch`, `getKpiForDay`,
  `getAllTimeKpi` and `getTodaysMetrics` take an OPTIONAL `db?: SupabaseClient` and use
  `args.db ?? (await createClient())`. The file header now records the outage, the measured
  evidence, and why the service client would be the wrong answer here.
- read-path: a rep on the phone sees the knocks they actually logged instead of zeros, and a
  knock they log is written instead of refused.

### NOT the service client, and this differs from the brain fix
- write-path: the same header explains the split. In `lib/brain` the reads are company CONFIG
  behind a server-resolved id, so the service client widened nothing. Here RLS is doing REAL
  per-rep access control - a rep sees their own rows, a manager the team's - so bypassing it
  would widen access rather than restore it. The caller passes the client that already
  represents them; both are RLS-scoped and only the transport differs.
- read-path: a manager still sees exactly what RLS grants them, unchanged.

### The routes hand over the client they already resolved
- write-path: `door-log/route.ts` passes `db: sb` to `createKnock`/`createPitch` and `sb` to
  `getAllTimeKpi`/`getKpiForDay`; `todays-metrics` passes `sb` to `getTodaysMetrics`;
  `my-training` passes `sb` to `getAllTimeKpi`. Each route had already built the right client.
- read-path: no route changed which client it resolves, so no web request behaves differently.

### The gate (A30)
- write-path: `src/lib/data/__tests__/doorlog.callerClient.test.ts` mocks `createClient` to
  THROW, so any rep-facing function that reaches for the cookie client despite being handed
  one fails loudly by name. A third test pins the other half: omitting `db` still uses the
  cookie session, so the web path is unchanged.
- read-path: this class cannot silently return. Mutation-proven - reverting `getKpiForDay`
  fails the named test.

## Files
- `src/lib/data/doorlog.ts`
- `src/app/api/coach/sales-session/door-log/route.ts`
- `src/app/api/coach/sales-session/todays-metrics/route.ts`
- `src/app/api/coach/sales-session/my-training/route.ts`
- `src/lib/data/__tests__/doorlog.callerClient.test.ts`

## Ripple (SS1.5)
- `db` is optional everywhere, so every existing web caller is untouched. A test pins it.
- The worker's `createAdminClient` writes (`claimPitchesToProcess`, `writePitchTranscript`,
  `writePitchAnalysis`, `setPitchStatus`, `upsertRepPatternSummary`) are deliberately NOT
  changed: the worker has no caller and the file's own design makes it the only writer to the
  derived tables.
- `coach-assessment` also imports `getAllTimeKpi` but is not called by the mobile app and has
  no `callerScopedDb`; it is left alone and recorded in check.md F2 rather than changed blind.
