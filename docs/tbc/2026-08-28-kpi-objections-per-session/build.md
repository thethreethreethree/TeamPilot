# BUILD — Objections per session (real whole-call tally)

### The tally the LLM emits (extend the existing moments pass — no new call)
- write-path: `salesMomentsPrompt.ts` adds a whole-call `objections: {raised, resolved}` field to the moments
  prompt + output schema (distinct from the 3-5 hero moments; resolved ≤ raised, 0 if none).
- read-path: `salesMoments.ts parseObjectionTally` clamps to non-negative ints (resolved ≤ raised) and returns null
  when omitted; `SalesMoments.objections` carries it; `afterPitch.ts` stores it on the `AfterPitchSummary` payload.

### The KPI reads the stored tally (honest exclusion of un-tallied sessions)
- write-path: `compute.ts objectionInputFromPayload` reads `payload.objections`, returns NULL when absent (a
  pre-tally summary) — so the session is EXCLUDED, never counted as a false 0. `objectionsPerSession` (avg raised)
  and `objectionResolutionRate` (resolved ÷ raised %) gate at MIN_SESSIONS; the rate ALSO gates when 0 objections
  were raised (undefined rate → building, never a fabricated 100%).
- read-path: `me/route.ts` maps the same `apRows` through the parser and `.filter(r => r !== null)`, then sets the
  two metrics. `kpi/page.tsx` renders "Objections per session" (num) + "Objections resolved" (pct) tiles.

### Honesty guards (§3.4)
- write-path: a missing/invalid tally → null → excluded; a zero-objection sample → resolution rate gated.
- read-path: a rep with too few tallied sessions sees "building", never a guessed objection number, and never a
  100% resolution over zero objections.

## Files
- `src/lib/coach/v5/salesMomentsPrompt.ts` — objection tally instruction + schema field
- `src/lib/coach/v5/salesMoments.ts` — ObjectionTally, parseObjectionTally, SalesMoments.objections
- `src/lib/coach/v5/summaryTypes.ts` — ObjectionTally shared shape
- `src/lib/coach/v5/afterPitch.ts` — thread objections into AfterPitchSummary payload
- `src/lib/coach/kpi/compute.ts` — objectionInputFromPayload (nullable) + objectionsPerSession + objectionResolutionRate
- `src/app/api/coach/kpi/me/route.ts` — build + filter objectionRows, set the two metrics
- `src/app/dashboard/sales-coach/kpi/page.tsx` — wire the two Layer-2 tiles
- tests: `compute.test.ts` (+7 objection cases), `salesMoments.test.ts` (+2 tally-parse cases)

## Ripple (§6 item 5)
- Additive field only: `SalesMoments` / `AfterPitchSummary` gain a nullable `objections`; every existing consumer
  (After-Pitch page, PDF, cueLoop) ignores it. The append-only after_pitch_summaries means a re-generated session
  gets a NEW row WITH the tally; the null-filter makes the KPI read the tallied row and skip the old one.
- The team roster is untouched (objections is a /me self-view Layer-2 metric; the founder didn't ask for a column).
- No migration: the tally rides inside the existing jsonb `payload`.

## Honest limit (verify)
- The LLM actually returning a SENSIBLE tally over a real transcript is founder visual-verify — unit tests cover
  the parse + the compute + the honesty gates, but not the model's counting judgement (no live LLM in jsdom).
- Existing sessions have no tally, so the metric gates until re-analyzed (correct §3.4 behavior); a bulk backfill
  is a separate founder cost decision, not run here.
