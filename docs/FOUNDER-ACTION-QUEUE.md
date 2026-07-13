# Founder action queue — as of 2026-07-13

> **Build status: deploy-ready.** All four gates green as of 2026-07-13 — `tsc --noEmit` 0 errors,
> ESLint (`src`) 0 problems (fixed 2 unused-import errors that could fail `next build`), 617 vitest
> pass, `next build` compiles. The migrations still need applying (below); the app code ships clean.
> One artifact left untracked in git: **`FinancialSystem.md`** (the spec) — tell me if you want it
> committed to the repo or intentionally kept out (it references the IP docs, so I didn't add it blind).


One prioritized page for everything awaiting your call after the autonomous Financial-System
session. Ordered by severity/impact. Each item names its artifact + my recommendation. Nothing here
is a blocker I can clear autonomously — each needs your judgment, a live environment, or an apply.

---

## 1. SECURITY — stage + apply `0112` and `0113` (HIGH / MED)
Real, built, static-verified fixes awaiting one **live staging cycle** before promote:
- **`0112`** (HIGH) — `company_brain.system_prompt_addendum` was member-writable → company-wide prompt
  injection (incl. customer-facing C.A.R.E replies). Fix routes brain writes through DEFINER
  (`record_brain_learning`, `create_empty_brain_for_company`) + restricts `company_brain` /
  `brain_evolution_events` to SELECT-only. **Do NOT bundle with the 0101–0111 batch.** Staging test:
  run a learning cycle + a company-create, confirm nothing breaks.
- **`0113`** (MED) — members could fabricate their own ELO inputs (`after_pitch_summaries`,
  `coaching_sessions`, transcript/cues) → self-inflate §3.5 score. Fix removes the member INSERT
  policies (all legit inserts are service-role — safe by construction).
> Event-scoring trace DONE (2026-07-13): the 7 user-scoped `coach.*` kinds (review/after-pitch/
> decision/analyze/debrief/grade-sent/observe) feed **NO score** — the ELO reads only service-role
> sources (`coach.dissect_generated` events + the `after_pitch_summaries`/`coaching_sessions` tables).
> **No RLS change to the 7 is needed.** The one remaining §3.5 event-fabrication vector is the
> `coach.dissect_generated` events-INSERT-policy residual → item 4 below.

## 2. FINANCE — apply `0145`–`0153` + walk the runbook
Built, dependency-ordered, idempotent, chain contiguous (no gaps/dups). Carries the sweep fixes
(`0145` bank-match 1:1, `0150`/`0151` year-end-close RE-3000 + net=0, and a **row-lock sweep** that
serializes concurrent read-guard-post functions so nothing double-posts, double-pays, or over-credits:
`0147` (approve-bill / issue-invoice / approve-expense), `0152` (issue-credit-note), `0153`
(reimburse-expense → no double-payment, convert-PO-to-bill → no duplicate bill) — matching pay/receipt). Walk
`docs/financial-system/VERIFICATION-RUNBOOK-FULL.md` Steps 1–15. You're through `0144`.

## 3. FINANCE DECISION — tax-report credit-note netting
`docs/financial-system/TAX-CREDIT-NOTE-NETTING-DECISION.md`. The report overstates tax owed when
credit notes exist (a live amber warning is up meanwhile). 3 attribution options + **recommendation A**
(proportional to the linked invoice's jurisdictions). One-read decision.

## 3b. FINANCE DECISION — recurring-bill monthly date drift
`docs/financial-system/RECURRING-DRIFT-DECISION.md`. Monthly templates use `next_date + 1 month`, so a
"31st" bill drifts to the 28th permanently after a February. 3 options + **recommendation A** (anchor to
day-of-month via an `anchor_day` column, clamped to month length — recovers instead of drifting). Low
severity, one-read decision.

## 4. SECURITY REVIEW — two deliberately-held items (your judgment)
Both have ready text; both withheld from autonomous action on purpose (§5/§2/§A17):
- **`events` INSERT-policy residual** (`coach.dissect_generated`) — ready SQL in
  `AUDIT-2026-07-09-brain-injection.md`. Held because it edits the single most critical RLS policy in
  the §3.1 chain for a MED fix — a core-policy change deserves your review.
- **C.A.R.E prompt injection defense** (`src/lib/care/prompt.ts` has none) — a warmth-preserving
  instruction is drafted in the findings doc. Held because the persona is tuned + runtime-unverifiable
  headless (§A17); add it, then smoke-test warmth.

## 5. FINANCE PHASE 8 — confirm to build
`docs/financial-system/PHASE-8-DATA-MODEL.md` (Payroll = post, don't build; Assets = register +
depreciation + disposal). Proposal-reviewed: payroll-entry balance bug fixed, depreciation
salvage-floor / active-only / gain=proceeds−NBV rules pinned. Build-ready on your confirm.

## 6. FINANCE PHASE 9 gaps — confirm to build
`docs/financial-system/PHASE-9-DATA-MODEL.md` (approval delegation + opening-balance import; RBAC/SoD/
encryption/backup already built). Proposal-reviewed: delegation SoD-bypass rules + honest-import
(Opening Balance Equity surfaces imbalance) pinned. Multi-entity + integrations deferred unless you
need them.

---

### Recommended hardening (structural backstop for the double-post class)
The row locks (0147/0152/0153) fix the active concurrency bugs. A **unique index on
`fin_source_postings (source_type, source_id, kind)`** would make double-posting *structurally*
impossible — a safety net if a future posting fn ever forgets the lock (§3.2). It's safe by design:
`issue` is one-per-document, and `payment` uses the payment record's own id as `source_id` (unique per
payment), so there are no legitimate collisions. **Not added to the apply batch on purpose**: if any
*pre-lock* duplicate already exists in your data, the index creation fails and would halt the apply. Run
this first — `select source_type, source_id, kind, count(*) from fin_source_postings group by 1,2,3
having count(*) > 1;` — and if it returns nothing, add the unique index (I'll write the migration on your
say-so). A non-empty result is itself a real finding (an existing double-post to investigate).

### Non-finance finding — coach/care LLM routes lacked `maxDuration` → **FIXED** (verify live-vs-superseded)
**Resolved 2026-07-13 — CLASS DEFINITIVELY CLOSED (24 routes, verified by transitive-import closure).**
⚠️ **One caveat for you:** the two **backfill** routes (`coach/sales-session/backfill-dissects` +
`-cron`) process *many* sessions per call, so `maxDuration=60` is a floor, not necessarily enough — a
large backfill may still exceed 60s. Consider raising them (300s on Vercel Pro) or batching / making
them a proper background job. The 22 single-request routes are fully covered at 60s.

**(History) — 21-route fix + 3 deeper via transitive closure.** Added `export const maxDuration = 60;` to
every LLM route that lacked it: **10 direct-import** (coach/analyze, coach/v5/analyze+debrief+followup+
grade-sent, sales-session/roleplay+after-pitch, care ask-coach+followup, tasks/spawn) + **11 deeper-
chain** (route→lib→@/lib/claude: sales-session review/why-patterns/dissect/cue/prep/prep-qa/summary-
scores/why, dissect analyze+topics, care agent messages). So no LLM route — direct OR via a helper —
can be killed at Vercel's default. Matches the existing 24-route convention. tsc 0, ESLint 0, suite
green, `next build` compiles. Zero-risk config (only raises the timeout ceiling; no-op on any superseded route). Skipped the 2
non-blocking ones (`llm/ping`, `attribute`). **One thing for you to check:** if any of the 10 is a
superseded v1 route, the export is harmless there — but confirm coach/analyze (v1?) vs coach/v5/analyze
is the live one and delete the dead route if so. Original finding detail retained below.

<details><summary>Original finding (for the record)</summary>
App-wide sweep (the guard pushed me beyond finance) found a real gap in the **coach** subsystem:
`coach/analyze` `await`s an LLM call (`proposeCoachPatterns`, line 81) but has **no** `export const
maxDuration`, and there's **no global** maxDuration (checked vercel.json + next.config) — while **24
other routes set it**. An LLM call exceeds Vercel's ~10–15s default, so the route can be killed
mid-generation in production. **Precise affected list** (routes that import an LLM lib AND lack `maxDuration` — a reliable signal):
`coach/analyze`, `coach/v5/analyze`, `coach/v5/debrief`, `coach/v5/followup`, `coach/v5/grade-sent`,
`coach/sales-session/[id]/after-pitch`, `coach/sales-session/roleplay`, `coach/sales-session/attribute`,
`care/agent/conversations/[id]/ask-coach` (+ `/followup`), plus `llm/ping` and `tasks/spawn`. The coach
v5 + ask-coach + sales-session generation routes are the real ones (they await LLM content generation).
`tasks/spawn` is also real (calls `spawnTask` from @/lib/claude, a blocking LLM call). Lowest-priority /
skip: `llm/ping` (round-trips to the provider but it's a minimal connectivity ping — likely fast) and
`attribute` (memory notes it's a lightweight helper). **Fix** (trivial, zero-risk, matches the existing 24-route
pattern): add `export const maxDuration = 60;` to each that blocks on an LLM call. I did NOT auto-edit
them — it's your subsystem and I don't know which are live vs superseded (v1 vs v5); you know which. The
class was "swept 2026-07-09" per a code comment, so these were added/missed after. **Confirmed (checked
2026-07-13): none of these stream** — they all `await` the LLM call and return JSON, so there's no
streaming exception; every blocking one genuinely needs the export. The only open question per route is
live-vs-superseded, which you can answer instantly.
</details>

### Known VERY-low-severity concurrency edge (mostly closed by a trigger; residual accepted)
`fin_post_system_entry` checks `period.status = 'open'` then inserts without locking the period. Good
news, on re-examination: the `fin_entries_immutable` trigger (0118) **re-checks the period status on
every INSERT** and rejects `closed`/`locked` — so any post attempted after a year-end close locks the
period is already rejected at insert. The ONLY residual is the microsecond gap between the close's P&L
*snapshot read* and its period *lock commit*: a post that commits in that sliver lands in the period but
isn't captured by the close's snapshot (RE then off by that one entry). Extremely rare, and correctable
by reopen→reclose. Not fixed because closing even that sliver means `select … for share` on the period
in every post — hot-path contention for a near-impossible race. Accepted, documented edge; add the
`for share` only if you want provable strictness over throughput.

### Latent — fix before exposing `fin_reverse_entry` (no UI/route calls it yet)
`fin_reverse_entry` (0118) guards only that the original is `posted` — it does **not** check whether a
reversal already exists, nor lock the row. So the same entry could be reversed twice (two drafts → both
posted → **over-reversal**, ledger corrupted). It's currently unreachable (nothing calls it), so it's a
landmine that activates the day a "reverse entry" button ships. When you build that UI, first re-create
the fn with: `select … for update` on the original, and `if exists (select 1 from fin_journal_entries
where reversal_of = p_entry_id and status <> 'void') then raise 'Entry already has a reversal'`. Double-
reversal is always wrong accounting, so this is an unambiguous guard, not a design choice.

### Optional polish (low priority, your call)
- **WCAG-AA input labels** — the finance entry forms (~29 inputs across ap/ar/banking/budgets/tax/
  credit-notes/profitability) use `placeholder` as the field label. Inputs are still *named* (the
  placeholder is the accname fallback), so this is AA-polish, not a defect — persistent `aria-label`s
  would harden it if you want strict AA. Left un-churned deliberately. (The one real a11y *defect* — two
  nameless icon-only buttons — was fixed, commit `17a4970`.)

### Also on the record (no action needed — context)
- **Older security batch `0101`–`0111`** still UNAPPLIED (author-spoof / tenant-key / cascade fixes);
  `0141`/`0142` (invite-escalation, subledger SoD) UNAPPLIED. Prioritized index:
  `docs/SECURITY-FINDINGS-2026-07-09.md`.
- **Dormant crons** awaiting operator wiring: §3.5 durability sweep, task-overrun sweep (code ready).
- Full session detail: `docs/closures/2026-07-11-financial-system-session.md`.
