# CHECK — "I pressed Score them all and nothing happened": the AI account ran out of credit

## How it was found

Not from code. Code reading had ruled out the deploy (`8973c6b0` Production READY), hydration (the
"194" can only come from the component's own GET) and the two scoring checks disagreeing. The
remaining evidence was server-side. The founder chose, in a picker, to let the agent read production
logs with the Vercel login already on the machine (read-only, `npx vercel@60.0.1 logs`).

## What the record says [OBSERVED]

- Project `team-pilot` serves `https://elostate.com` (`vercel project ls`).
- 168 POSTs to `/pitch-score/backfill` between 11:51 and 12:58 on 09-25 — every "Score them all" press
  reached the server, and returned 200.
- Every `[scoreSession] threw` line carries the same error:
  `LlmError: DeepSeek API error 402: {"error":{"message":"Insufficient Balance …"}}`.
- **First 402 in production: 2026-09-22 17:00:40 +08** — found by paging back (each 1,000-row window was
  truncated and treated as a floor), then per-day and per-3h probes; the final window returned 10 rows,
  under the limit, so this is the start and not a floor.
- Also failing with 402 since then: `/pitch-processing-cron` (door-pitch analysis, ~20/min) and
  `/practice-scenario/from-pitch`.
- Production env has 10 variables and **no `ANTHROPIC_API_KEY`** (names only, `vercel env ls`). DeepSeek
  is the only provider; failover had nothing to fail over to.
- No 402 since 11:59 on 09-25; the cron keeps running (≈8/min, 200, no log lines). **[INFERRED]** the
  queue drained into terminal `failed`, not that the balance was restored — unverified either way.

## Why the button looked dead

The panel reported the outcome as `errored` — "failed unexpectedly for …" — because `scoreSession`
filed a billing refusal under the generic catch. The drain walked all 194 recordings in 25 passes to
learn what the first one proved.

## Why door pitches were lost, not delayed [OBSERVED, code]

`llm/errors.ts:65` classifies 402 as `quota`; `llmCall` cascades only on `auth` / `model_unavailable`,
and re-throws the original error; `runBrainCall` has no catch; `analyzePitch` catches only `JSON.parse`.
So the `LlmError` reached the pitch worker intact — where `isPermanentFailure` did not match it, and
each pitch spent `MAX_PITCH_ATTEMPTS = 5` and became terminal `failed`. `failed` is never re-selected.

## Fixed

1. `scoreSession`: `kind === "quota"` → new refusal `provider_out_of_credit` (not permanent; 503 on the
   single-score route). The backfill halts the run on it, like `suppressed`. Halted note now says
   "Nothing more can be scored" — true even when a balance empties mid-run.
2. Pitch worker: on `quota`, give the attempt back, keep the status, defer 15 min, log one line, no
   Sentry flood. A billing outage of any length no longer destroys pitches. The pitch worker is the
   only attempt-ceilinged worker in `src` (swept).
3. `docs/ops/2026-09-25-requeue-pitches-failed-on-402.sql` — dry-run count, a transactional re-queue,
   an after-check. **Not run.**

## Tests, and three vacuous ones of mine

The first 402 test received a TypeError instead of the 402. Cause: the test file's shared `args` uses
`skipIfScored: true` with an empty `db`, so `db.from("pitch_scores")` threw before any later step. That
made three of this morning's tests pass WITHOUT reaching what they were named for — "throwing LLM
call", "throwing transcript read", "throwing write" — and the write test's success mock also lacked
`ok: true`. All fixed; each now asserts the call was actually made.

Mutations: quota check removed → 1 fails; backfill halt removed → 2 fail; scoreSession try/catch
removed → 7 fail (this morning's "5 of 6" included passes via the TypeError); worker quota branch
removed → 2 fail while the CONTROL (a 500 on the last attempt is still terminal) keeps passing.

`npm run check`: CHECK_EXIT=0, 5,538 passed, invariant violations 0.

## Not verified

Whether the DeepSeek balance is empty right now; how many pitches are in `failed` with this error (STEP 1
of the SQL answers it — the agent has no production database access and did not seek it).

## Not opened

No image, icon, logo, favicon or graphic asset was touched. Production log lines were read in the
terminal only; no customer content was copied into the repository.
