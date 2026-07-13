# Founder action queue — as of 2026-07-13

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

## 2. FINANCE — apply `0145`–`0151` + walk the runbook
Built, dependency-ordered, idempotent, chain contiguous (no gaps/dups). Carries the sweep fixes
(`0145` bank-match 1:1, `0150`/`0151` year-end-close RE-3000 + net=0). Walk
`docs/financial-system/VERIFICATION-RUNBOOK-FULL.md` Steps 1–15. You're through `0144`.

## 3. FINANCE DECISION — tax-report credit-note netting
`docs/financial-system/TAX-CREDIT-NOTE-NETTING-DECISION.md`. The report overstates tax owed when
credit notes exist (a live amber warning is up meanwhile). 3 attribution options + **recommendation A**
(proportional to the linked invoice's jurisdictions). One-read decision.

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
