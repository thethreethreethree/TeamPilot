# Live production-DB verification — 2026-07-27

Once Session-pooler DB access was available this session, several claims that had been
"static-only / runtime-unverified" were checked against the **live production database**
(not migration files, not memory). This is the on-record consolidation (§1.7.4) of those
checks. All queries were READ-ONLY; nothing was written or changed.

Connection: `SUPABASE_DB_URL` (Session-pooler, `ap-northeast-1`) from `.env.local`.

## 1. Migration state — all applied (reconciles a stale doc)

- `public._agent_migrations` ledger: **195 applied** (0001→0195).
- `0188`–`0193` all present in the ledger.
- **`care_tenant_config.extension_trial_started_at` (0189) column: PRESENT ✓** — the column the auto-trial
  fix (tester remediation, closure finding 1) writes to. So the fix works in production, not just in tests.
- **Consequence:** `FOUNDER-ACTION-QUEUE.md` item 4b ("0188–0193 PENDING / trial column absent") was STALE and
  directly contradicted the fix; corrected (commit reconciling 4b + item 1).

## 2. Extension entitlement distribution — finding-1 blast radius

`care_tenant_config`: **13 tenants, 0 paid** (confirms deliberate pre-billing state).
- **12 `pilot` + no trial → LOCKED**; each AUTO-TRIALS on its next extension tool call once deployed. This is
  finding-1's real blast radius — 12 tenants unblock with no manual step.
- **1 `pilot` + trial-started ~07-22** — BEFORE this session's fix and the columns had no writer until now, so
  it was MANUALLY set (a prior test-unlock), NOT the auto-trial firing. So the auto-trial has not fired in
  production yet; the 12 locked pilots are the live-verification candidates. Correctness holds: that pre-set
  trial computes as `trial` (~day 5 of 14), so `shouldAutoStartTrial` is false — it will not re-fire.
- **⚠️ Flag:** that one trial EXPIRES ~2026-08-05; if it's a real pilot, it will then show the honest
  "trial ended — contact admin" message and need a manual unlock.

## 3. Finding-25 (audio PII-retention hole) — zero existing damage

Detection query (the finance-0196 discipline: fix the write, then prove historical data clean): of **47**
`coaching_sessions` with an audio pointer, **0** are in a non-purgeable (non-`assets-v1/`) shape. So the
full-URL write path was never exercised — the hole was purely latent, no orphaned recordings, **no cleanup
burden**. Finding 25 is airtight: write path removed → regression-test-locked → historical data proven clean.

## 4. §3.2 understanding gate — fail-closed AND functional (thesis core)

The product's differentiator ("a problem cannot reach a human without enough supporting signals"), verified
against the LIVE trigger, both halves:
- **Fail-closed (mechanism):** the live `check_understanding_gate` body, on a problem leaving `draft`, looks up
  the per-kind threshold (falling back to `*`); if NO threshold row exists it `raise exception`s — refuses to
  surface an un-evaluable problem rather than waving it through. Dismissal is correctly exempt. This is 0190's
  fail-closed version, confirmed in the deployed function, not just the migration file.
- **Functional (data):** `problem_thresholds` has the `*` default present — **signals ≥ 3, distinct sources ≥ 2,
  diagnosis ≥ 80 chars**. So the gate evaluates real thresholds; it is NOT fail-closed-to-dead (a missing `*`
  would raise on every surfacing and silently kill the problems feature). Both the mechanism and its
  configuration are sound.

## 5. §3.5 communication-quality — the honesty moat holds (mirror ≠ consequence)

The thesis's most-guarded rule: the communication-quality metric must be anchored to downstream CONSEQUENCE
(resolution rate/time, clarification cycles, durability), NEVER to a self-graded rubric or "the AI's suggestion
was adopted" — measuring agreement is grading your own homework, forbidden. Verified (code, not DB) that this
holds structurally:
- **The rubric is a MIRROR, not a verdict.** `grader.ts` scores each reply on acknowledged/answered/next-step
  (0|1) via an LLM rubric — a self-graded structural read. `careQualityGrade.ts` frames it exactly as the
  defense requires: §A11 "mirror, not verdict" (the letter travels with its raw count basis), §A18 no-"F"
  (coaching target, not penalty), §A4 (formula is retune-when-data-answers instrumentation), §3.5 honest-empty
  (0 replies → null, never a low letter).
- **The rubric is NEVER the improvement claim.** Grep for `careQualityScore`/`coachAggregate` used in any
  month-over-month / trend / baseline / before-after context: EMPTY. So the self-graded rubric is not presented
  as "communication quality improved"; that proof is the consequence metrics (resolution via durable
  `resolved_at`/`closed_at`).
- **Net:** intervention (coaching rubric + Co-Pilot/Formulate) and measurement (consequence/resolution) are
  correctly separated — §3.5's causal order ("better communication is the mechanism; faster resolution is the
  result"). The grading-own-homework trap is structurally avoided.

Together with §4 above, the product's two core honesty mechanisms — §3.2 (understanding precedes surfacing) and
§3.5 (consequence, not agreement) — are both verified sound this session.

## What remains structurally unverifiable here

The one link no static/DB check can reach: a fresh pilot tenant clicking an extension tool in a real browser
(→ trial, not 402). There are 12 concrete locked-pilot candidates for that live confirmation.
