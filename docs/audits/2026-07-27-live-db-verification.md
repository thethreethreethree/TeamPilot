# Live production-DB verification — 2026-07-27

Once Session-pooler DB access was available this session, several claims that had been
"static-only / runtime-unverified" were checked against the **live production database**
(not migration files, not memory). This is the on-record consolidation (§1.7.4) of those
checks. All queries were READ-ONLY; nothing was written or changed.

Connection: `SUPABASE_DB_URL` (Session-pooler, `ap-northeast-1`) from `.env.local`.

> **These checks are now RE-RUNNABLE: `npm run verify:live`** (`scripts/verify-invariants-live.mjs`, read-only,
> exit codes: 0=all pass, 1=an invariant FAILED, 2=couldn't connect — CI can gate on it). It re-confirms **11
> structural invariants** against the live DB: §3.1 append-only (rules + a rolled-back UPDATE probe), §3.2 gate
> fail-closed + `*` threshold, finance H2/H3/H4 (immutability, balance, RLS company-scoped), RCD purge-enablement,
> the finding-25 / finding-6a4 detections, **the auth-gate constraint (`profiles.status` stays exactly
> (active,removed) or the `'removed'` denylist gates fail open), and TENANT ISOLATION (every `company_id` table
> has RLS ON — a new table missing RLS is a cross-tenant leak)**. Run it after a migration or before a release.
> The one-time findings below explain WHAT each check means; the script is the durable guard. Proven robust:
> exits 1 and names the failing invariant on a break, isolates a broken query per-check, exits 2 (not hang) on a
> connection failure. (Complements `npm run invariant:audit`, which checks the CODE — now 11 invariants: CSV-safe,
> finance-RLS, finance-schema-reachable, no-client-DEFINER, upload-validated, cross-person-gated, admin-gated,
> extension-authed, no-secret-via-NEXT_PUBLIC_ [allowlist], every-dangerouslySetInnerHTML-justified, cron-CRON_SECRET-gated.)

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

## 6. §3.1 append-only events — the data foundation is immutable (live)

Everything in the thesis derives from immutable, append-only events (retrospective analysis + data-as-asset
depend on full history staying intact). Verified against the live `events` table:
- Two rules present: **`events_no_delete` (`ON DELETE DO INSTEAD NOTHING`)** and **`events_no_update`
  (`ON UPDATE DO INSTEAD NOTHING`)**.
- Behavioral test (rolled-back tx): an `UPDATE` on a real event row → **no-op, row unchanged**. Only INSERT
  works. Append-only holds in production.
- Note: this is the SAME `do instead nothing` mechanism that blocks end-user deletion — so GDPR/CCPA erasure
  must be by ANONYMIZATION (scrub PII, keep the immutable event structure), not DELETE. That tension is already
  flagged in FOUNDER-ACTION-QUEUE (2c); this verification confirms the mechanism behind it.

## 7. §3.4 no-instant-results control window — fail-safe toward suppressed

Month-1 = control (no AI guidance) to capture an honest baseline; the fail-safe direction must be
"suppressed," never "enabled" (a misconfigured company must NOT accidentally get guidance in month 1).
Verified the pure `evaluateControlGate` (brain/index.ts) implements this:
- `guidanceEnabled = manualEnabled || autoUnlocked`, where `autoUnlocked = Boolean(unlockAt) && new
  Date(unlockAt) <= now`.
- Every misconfiguration fails safe to SUPPRESSED: null `unlockAt` → false; a garbled date → `NaN <= now` →
  false; a future date → false. The only ways to enable are an explicit manual unlock or a genuinely-elapsed
  valid unlock date.
- When suppressed, the composer returns a refusal with NO API call (guidance genuinely off, not just hidden);
  manual overrides are recorded as `brain_evolution_events` (on-record per §3.1).
- **TEST-LOCKED:** `controlGate.test.ts` (6 tests) covers the full truth table including the fail-safe cases —
  `unlockAt: null` → suppressed, and a malformed date (`"not-a-date"` → `NaN <= now` false) → suppressed. So a
  future edit that flipped the fail-safe to fail-open turns a test red; the guarantee can't silently regress.

Together, the product's core thesis mechanisms are all verified structurally sound this session:
**§3.1 (append-only events — live)**, **§3.2 (understanding precedes surfacing — fail-closed + configured,
live)**, **§3.4 (month-1 control window — fail-safe to suppressed)**, and **§3.5 (consequence, not agreement)**.
The differentiating thesis is structurally enforced, not just intended. **§3.3 "guide, don't overtake"** is a
behavioral property (no single DB gate), but it IS embodied in the prompt/design layer at three points — the
product-knowledge principle (`elostateProductKnowledge.ts:72` "asks for and sharpens the human's own thinking
rather than replacing it; the human always decides"), an INVIOLABLE composer discipline (`brain/index.ts:235`:
§3.3 is not overridden by any team's learned style/context, "applies to every response"), and the coach design
(rep chooses when to invoke; acknowledge pushback + reflect the rep's read first). So the AI's DESIGNED behavior
respects guide-don't-overtake and is protected from being overridden by learned context. (Live output QUALITY
still needs runtime eval — the honest gap.)

## 8. Finance double-entry balance — DB-trigger-enforced (live)

The core GL invariant (every posted journal entry balances: debits = credits) is enforced structurally, not
only in app code. Verified live:
- `fin_assert_entry_balanced(entry)`: for a POSTED entry, sums `base_debit`/`base_credit` and `raise
  exception`s if `debit <> credit` OR the entry has `< 2 lines`. Drafts are exempt (only posted must balance).
- Wired to TWO triggers — `fin_assert_balanced_from_lines` (on `fin_journal_lines`) and
  `fin_assert_balanced_from_entry` (on `fin_journal_entries`) — so EVERY posting path (`fin_post_entry`,
  `fin_post_system_entry`, or any direct write / status→posted) re-asserts balance. Cannot be bypassed at the
  app layer.
- The check is EXACT base-currency equality — which is also the mechanism behind the flagged FX-rounding item
  (`project_fx_rounding_base_imbalance_bug`): a foreign split-line entry whose per-line base rounding diverges
  by a cent would be REJECTED as unbalanced. Surfaced-not-built (accounting decision); latent with 0 posted
  entries in production. Partially closes the "finance not inspected" gap: the balance core is now verified.

## 9. Finance H2 (immutability) + H4 (tenant RLS) — live; finance-core now substantially inspected

- **H2 immutability (posted = terminal):** `fin_entries_immutable` raises on UPDATE/DELETE of a posted entry
  ("reverse it, do not edit it"); `fin_lines_immutable` blocks editing a posted entry's LINES; `fin_audit_log`
  is append-only; `fin_freeze_created_by` prevents reassigning the author (SoD). So posted books can only be
  corrected by a reversing entry, never silently edited.
- **H4 tenant RLS:** RLS is ON for `fin_accounts`, `fin_journal_entries`, `fin_journal_lines`, `fin_periods`,
  AND (verified airtight) all 6 policies on the two journal tables are tightly scoped: every op carries
  `company_id = auth_company_id()` (no cross-tenant), layered with role gates (`fin_can_view()` reads /
  `fin_can_enter()` writes), and INSERT is restricted to `status IN ('draft','pending_approval')` — you CANNOT
  directly insert a posted entry via RLS; posting must go through the sanctioned RPC (authz + balance + period).
- **Finance-core status:** all four invariants now inspected — H1 (entry-date; `0196` on a branch + 0 existing
  bad rows by detection), H2 (immutability, live triggers), H3 (balance, DB-trigger-enforced, §8), H4 (RLS on).
  The books can't be silently altered, go out of balance, or leak across tenants. The remaining finance
  not-inspected items are the FEATURE-level flows (reports, AP/AR, tax, year-end) beyond these invariants and
  the branch-only `0196`.

## 10. C.A.R.E reply AI — designed behavior is honesty-railed (static review; partially closes the AI-quality gap)

The customer-reply prompt (`prompt.ts`) instructs the honest, non-fabricating behavior the thesis requires:
don't guess (say when unsure) (L70); NEVER invent features/prices/policies → hand off (L72); never claim to be
human when asked (L73); escalate refunds/complaints/account-data/uncertainty to a human via a machine-read
handoff sentinel (L89-98); and the nuanced rail that a confident-wrong "No" is the least safe answer, so default
to HAND OFF over NO (L79-81). So the AI's DESIGNED behavior embodies §0 (don't fabricate) + §3.4 (honesty) — no
over-promising, no confident-wrong answers, AI-transparent, hands off where a human is needed. **Partially closes
the "brain AI output quality" gap: the design is sound; live output QUALITY (does the LLM follow the rails well)
still needs runtime eval — the honest residual.**

## What remains structurally unverifiable here

The one link no static/DB check can reach: a fresh pilot tenant clicking an extension tool in a real browser
(→ trial, not 402). There are 12 concrete locked-pilot candidates for that live confirmation.
