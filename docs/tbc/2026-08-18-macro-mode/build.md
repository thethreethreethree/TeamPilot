# BUILD — Macro Mode (checkpoint: Phase 0–2 + logic foundation)

This records the FIRST shippable slice: the schema/RLS (applied) + the decision-independent logic + the
macro-rollup engine. Phase 3 (API route + cron worker + Sentry) and Phases 4–5 (Door Log + Report Card UIs)
are the tracked remainder (see closure.md residual).

### Schema + RLS (Phase 2 — applied via db:apply, migrations 0215–0218)
read-path: Phase 0 map (`think.md sec 4/4a`) — `company_id` tenancy, `auth_company_id()`, the 0084
owner-or-manager RLS shape, `touch_*_updated_at`, no generic jobs table.
write-path: `0215` creates 5 tables (`door_knocks`, `pitches`, `pitch_transcripts`, `pitch_analyses`,
`rep_pattern_summaries`) + `rep_kpi_daily` view + rep+manager RLS (Q4). `0216`/`0217` make the view
`security_invoker` (verify:live caught the RLS-bypass). `0218` pins `company_id` on the pitches UPDATE policy
(rls:audit caught the tenant-move gap). rls:audit + verify:live (26/26) both pass.

### Decision-independent logic (`src/lib/coach/doorlog/`, 18 tests)
read-path: build-prompt spec 2/5.
write-path: `stateMachine.ts` (spec 5.1), `outcomes.ts` (spec 5.2), `retryBackoff.ts` (spec 5.4), `salesDay.ts`
(spec 5.5, Intl-based — avoids the UTC-day bug), `analysisSchema.ts` (spec 5.7 — the LLM output contract; malformed
JSON → null → retryable, never a silent write).

### Macro rollup engine (`rollup.ts` — the Report Card centre of gravity, spec 3.4b)
read-path: reuses `runBrainCall` (DeepSeek→Anthropic cascade, `controlExempt` like the day-1 Sales Coach),
`CONVERSATION_IS_DATA` fence, and the `parsePatternRollup` contract.
write-path: `generateRepPatternRollup(...)` finds RECURRING patterns ACROSS a period's pitches (not per-pitch)
+ a trend vs. the previous period, correlated with the outcome distribution. Per-pitch analysis REUSES the
existing sales rubric engine (spec 3.3 — no second "good pitch" definition), so only the macro layer is new.

## Founder decisions locked (2026-08-18)
Q2 consent = legally handled (NO in-flow gate) · Q4 = rep+manager · toggle = per-rep alongside · Q7 = full offline.

## Process lesson (feeds remediate.md)
Ran `db:apply` before `rls:audit`; the static audits (rls/invariant) are text-based and would have caught the
view + update-pin bugs PRE-apply, avoiding the 0216–0218 fix-forward chain.
