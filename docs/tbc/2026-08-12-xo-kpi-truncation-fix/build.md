# BUILD — KPI truncation fix (page the usage-growth reads)

## Feature inventory

### KPI me + team route reads page their usage-growth tables (`kpi/me/route.ts`, `kpi/team/route.ts`)
- write-path: none (read-only KPI computation). N/A.
- read-path: the seven previously-unbounded `.select().in/.eq(...)` reads on usage-growth tables now read via
  `fetchAllPaged((from,to) => sb.from(<table>).select(...).in/eq(...).order("id").range(from,to))`, so the JS
  aggregations they feed see EVERY row instead of the first 1000. /me: `after_pitch_summaries` (Layer-3
  quality/talk/skill/consistency), `coaching_cues` + `coaching_cue_outcomes` (cueAcceptanceRate) +
  `coaching_transcript_segments` (coachedSessions → Reliance Reduction). /team: `coaching_cues` (per-session
  reliance), `coaching_transcript_segments` (coachedSessions), `after_pitch_summaries` (quality-slippage).
  Reachable via GET /api/coach/kpi/me and /api/coach/kpi/team; locked by `kpi/__tests__/paged-reads.test.ts`.

## Files changed
- **src/app/api/coach/kpi/me/route.ts** — 4 reads wrapped in `fetchAllPaged` + `.order("id")`
  (after_pitch_summaries ~96; cues/cue_outcomes/transcript_segments ~135-137). Destructures changed from
  `{ data: x }` to the array `x` (fetchAllPaged returns rows directly); downstream `x ?? []` unchanged.
- **src/app/api/coach/kpi/team/route.ts** — 3 reads wrapped identically (cues ~113, transcript_segments ~129,
  after_pitch_summaries ~140). Added `id` to the cues/segments `select` so `.order("id")` has its column.
- **src/app/api/coach/kpi/__tests__/paged-reads.test.ts** (NEW) — source-level guard: every one of the seven
  reads sits inside a `fetchAllPaged(...).range(...)` window, and the segment reads order by `id`. Reverting
  any read to unbounded makes its table fall outside a fetchAllPaged window → the guard fails.

## What did NOT change (holistic — §1.5.1)
- The pure compute layer (`kpi/compute.ts`) is untouched — it already receives the row arrays and just gets the
  complete set now. Its tests are unchanged.
- Error handling preserved: each read keeps `.catch(() => null)` → the existing `?? []`, so ONLY truncation
  changed (no new fail-loud / no new swallow introduced).
- compute-cron + trajectory routes — already clean (sessions paged / low-growth snapshot table); untouched.
- The sessions read in both routes was already `fetchAllPaged`; unchanged.
