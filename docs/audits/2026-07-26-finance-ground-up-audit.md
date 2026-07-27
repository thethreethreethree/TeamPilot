# Finance layer — ground-up audit (§1.7), 2026-07-26

Outside-view stance (§1.3). Foundation-up: **application layer first (this doc's completed half), DB layer
second (in progress).** Recorded incrementally on the immutable record (§1.7.4) so a later audit can compare.
Evidence-driven (§1.5.2): hypotheses formed first, then verified — not mechanical grep.

## Scope + method
The double-entry finance layer (GL, AP/AR, expenses, banking, budget, tax, year-end; migrations 0116–0182,
TS in `src/lib/finance/`, routes under `src/app/api/finance/`). This audit looks for NEW money-integrity
issues; the KNOWN finance flags (FX rounding 0118/0119, calendar-FY assumption 0149/0151/0182, monthly
budget-variance 0191, tax credit-note netting) are already tracked in the founder action queue and are not
re-litigated here.

---

## A. Application layer — VERIFIED SOUND

### A1. No service-role RLS bypass on any finance route
Every finance route authenticates with `createClient()` — the **session** client (RLS-enforced) — and
`sb.auth.getUser()`; **none** uses `createAdminClient()` (service-role, which would bypass RLS). Confirmed
across all write/read routes:
- `ap/bills/[id]/approve/route.ts:15,19` — session client; delegates to the `fin_approve_bill` RPC, which
  enforces capability + period + draft-state **in the DB** (route comment `:7,21`).
- `opening-balances/route.ts:28,80`, `payroll/route.ts:31,82` (payroll adds a `getCurrentCompanyId()` pin
  as defense-in-depth, `:85`), `ar/invoices/[id]/route.ts:15`, `ap/bills/[id]/route.ts:15` — all session
  client, RLS-scoped by the company pin on each `fin_*` table.

**Verdict:** the app layer introduces no finance authz/isolation hole — integrity + capability enforcement
correctly lives in the DB (RLS + RPCs), not in bypassing route code. The audit's real surface is the DB.

### A2. Money-math boundary — no authoritative arithmetic in float-JS
Per the "never float for money" discipline (proved-with-exact-decimal lesson). Swept `src/lib/finance/`:
- `format.ts:11 formatMoney` — presentation only (documented `:8`).
- `format.ts:44 computeLineTax` — an **editable prefill** for the tax field; explicitly rounds to integer
  cents half-up BEFORE formatting (`:52-61`) to avoid the float half-cent bug ($100.50 @ 1% = 1.005 stored
  as 1.00499… → naive `toFixed` yields a cent-light "1.00"). Authoritative tax posting stays in SQL
  (`fin_approve_bill` / `fin_issue_invoice`). Correctly handled.
- `trialBalance.ts:109 tbImbalance` — surfaces an **imported** trial balance's imbalance as a fact to
  display (`:107-108` "never a defect to correct"), 4-dec rounded; not an enforcement gate on our ledger.
- `parseMoneyInput` — input parsing, NaN-guarded so a bad figure can't silently post as 0.

**Verdict:** all authoritative money math is SQL; the TS layer is display/prefill/parse only, and the one
arithmetic prefill handles the float trap. Sound.

---

## B. DB layer — VERIFIED (enforcement map confirmed against the highest-numbered definitions)

- **H2 — posted-entry immutability: SOUND.** `fin_entries_immutable()` (`0118:94`, BEFORE INS/UPD/DEL
  trigger `0118:112`) raises on any UPDATE/DELETE of a `status='posted'` entry ("reverse it, do not edit")
  and blocks any touch when the period is closed/locked. `fin_lines_immutable()` (`0118:117`, trigger
  `0118:134`) mirrors it for lines. Posted rows are terminal; correction is only via `fin_reverse_entry`.
  RLS also caps client writes to `status in ('draft','pending_approval')` (`0118:304`).
- **H3 — balance-check completeness: SOUND.** `fin_assert_balanced()` (`0118:142`) is a **DEFERRABLE
  INITIALLY DEFERRED constraint trigger** (`0118:164`) on `fin_journal_lines` for INS/UPD/DEL per row —
  fires at COMMIT, so multi-line inserts can be transiently unbalanced but MUST tie by commit. Sums
  `base_debit`/`base_credit` (server-computed by `fin_lines_compute_base`, `round(debit*fx_rate,4)` — client
  can't inject a false base). Backed by per-line CHECKs: nonneg + debit-XOR-credit (`0118:64-65`). Also
  asserted procedurally inside every posting RPC before the status flip. (The known FX-rounding flag lives
  in `fin_lines_compute_base`'s per-line rounding vs the exact tie — already queued, not re-litigated here.)
- **H4 — DB tenant isolation: SOUND.** **No `using(true)` / `with check(true)` anywhere in the finance
  layer** (grep-confirmed across `*fin*.sql`). Every core table is `company_id = auth_company_id()`-scoped
  plus a capability predicate (`fin_can_view/enter/approve/configure`): `fin_journal_entries` (`0118:293`),
  `fin_journal_lines` (`0118:311`), `fin_accounts` (`0116:169`), `fin_bills`/`fin_invoices` (draft-only
  client writes, author-pinned `0142`). Counters + `fin_source_postings` are select-only for viewers,
  mutated solely by DEFINER functions.

### H1 — closed-period posting: **REAL GAP (MEDIUM).** The close gate keys on `period_id`, not `entry_date`.

`fin_post_entry` (`0118:170`, the sanctioned manual-post RPC) checks only that the **referenced
`period_id`** is open (T-19, `0118:193-197`). It never checks that `entry_date ∈ [period.start_date,
period.end_date]`, and there is **no CHECK constraint or trigger** on `fin_journal_entries` tying the date
to the period (confirmed: no such constraint in the table def `0118:28-44`; `fin_entries_immutable` keys off
`period_id` status, not `entry_date`; grep for any `entry_date`↔period rule returns nothing).

- **The DATE-DERIVED document/subledger paths are IMMUNE** — `fin_approve_bill`/`fin_issue_invoice`/
  `fin_approve_expense`/AP-pay/AR-receipt/credit-note/reconcile all resolve the period *from the document
  date* and require an OPEN period that CONTAINS that date (e.g. `0147:126-129` `where status='open' and
  v_date between start_date and end_date`). They cannot mis-date into a closed period. (NOTE: this is
  NOT all document paths — payroll, inventory, and opening-balances pass a caller-supplied period without
  a containment check; see the "deeper sweep" correction in the class-sweep bullet below. My initial
  "all document paths immune" framing was too broad.)
- **The manual `fin_post_entry` path is the hole.** A draft can be inserted with `entry_date` in a closed
  period but `period_id` pointing at a *different, open* period (RLS insert policy `0118:296-300` validates
  only `status` + `created_by`, not date/period agreement). `fin_post_entry` sees an open `period_id` →
  passes T-19 → posts. The entry lands in the GL dated in the closed period, and all GL/reporting views
  aggregate by `e.entry_date` (`0151:56`, `0164:77`, `0165:57`), so closed-period figures shift silently.
- **Reachability (verified, keeps severity honest):** **NOT reachable through the current product UI** —
  there is no manual journal-entry surface in `src/app/dashboard/finance/` (every surface is document-driven
  → the safe paths), and no app code calls `fin_post_entry`. But `0183_fin_definer_revoke` does **not**
  revoke `fin_post_entry` (it stays callable by `authenticated` by design — the documented sanctioned
  posting primitive), so it IS reachable by a finance user with approve-capability via a **direct PostgREST
  RPC**, deliberately mis-setting `period_id` ≠ `entry_date`'s period. Internal actor, deliberate act,
  no external exposure → **MEDIUM**, not HIGH.
- **Only compensating control is detective, not preventive:** `0178_fin_integrity_check.sql:154-155` flags
  future-dated postings in a report; it blocks nothing.
- **Class sweep (§A26) — the "gate keys on a caller-supplied reference, not the actual data" class, each
  instance read directly (§A38, not relayed):**
  - `fin_post_entry` (`0118:170`) — **HAS the gap** (caller-supplied `period_id`, no `entry_date`
    containment). Confirmed.
  - `fin_reverse_entry` / `fin_post_reversal` (`0118:215` / `:248`) — **HAS the gap too**: takes
    caller-supplied `p_period_id` + `p_entry_date`, inserts the reversal with both (`:230-232`) and posts
    checking only `period_id` status (`:254-257`), no containment. **This is the MORE-exercised path**
    (reversal is the normal way to correct a posted entry), so it matters more than the base case.
  - `fin_reopen_year` (`0151:101`) — **CHECKED, SAFE.** (An earlier draft of this doc relayed a claim that
    it shared the pattern; reading it directly disproved that — it DERIVES `v_date =
    make_date(fiscal_year,12,31)` and selects the period `where status='open' and v_date between
    start_date and end_date` (`:121-124`), the same immune derive-from-date pattern as the document paths.
    Corrected here; a false "also vulnerable" claim would have sent a fix at a non-bug.)
  - Non-finance gates were considered and are NOT in this class: the care/RCD/extension/auth paths derive
    the tenant from the authed session (RLS / `auth_company_id()`), not a caller-supplied reference — so
    they can't be defeated the same way.
  - **⚠️ CORRECTION (deeper sweep — supersedes "bounded to 2 instances"; §A38 applied to my own fix):**
    because the fix is a trigger on ALL posted-entry writes, I then swept every one of the ~20
    `fin_post_system_entry` document callers. The class is BROADER than the manual + reversal pair:
    **payroll (`0167`, pay_date) and inventory (`0180`, current_date)** also pass a caller-supplied period
    with no containment check — their date belongs in-period, so they are additional instances the trigger
    correctly closes. The ~14 date-derived paths + fixed-assets (`0166`, dates at `period.start_date`) are
    provably in-period. **The one genuine EXCEPTION is opening balances (`0169`)** — `as_of` is a
    ledger-inception date posted into a client-supplied period and may legitimately fall outside it, so the
    trigger EXEMPTS `source LIKE 'opening_batch:%'` (founder accounting-convention decision to drop the
    exemption if opening balances are always in-period). My earlier "document paths immune / bounded to 2"
    framing was over-broad — corrected before it could ship a fix that rejects legitimate opening-balance
    imports.
- **Recommended fix (§A27/A31 — enforce the invariant at the chokepoint, not via caller discipline):**
  add an `entry_date ∈ [period.start_date, period.end_date]` containment check. Cleanest as an additive
  BEFORE-trigger on `fin_journal_entries` that fires on the transition to `status='posted'` (matching the
  existing T-19 timing so drafts and the already-safe document paths are unaffected), OR inside
  `fin_post_entry` alongside T-19. **A single BEFORE-posted trigger on `fin_journal_entries` fixes the
  whole class at once** — it covers the second confirmed instance too. **✅ DRAFTED on branch
  `fix/fin-h1-entry-date-in-period`:** migration `0196` (the additive trigger) + `verify_0196_*.sql`
  (detection query for existing mis-dated rows + isolated negative/positive trigger tests, rolls back).
  **On a branch, NOT main, on purpose** — it changes core-ledger posting behavior and is not live-verified,
  so it must not auto-apply as a side effect of the founder's `0188`–`0195` `db:apply`. Founder reviews →
  merges → applies → runs the verifier. Static gates pass (rls:audit, invariant:audit); SQL not executed.

- **Pre-apply verification of the drafted 0196 trigger (2026-07-27, read each cited path directly).** The
  trigger's correctness rests on two empirical claims (if either is wrong it rejects LEGITIMATE postings —
  the over-rejection risk this audit flagged). Both checked against the real migration code:
  - **Opening-balance exemption — CONFIRMED SAFE.** The trigger exempts `source not like 'opening_batch:%'`;
    `0169:176` posts exactly `'opening_batch:' || p_batch::text`. The prefix matches, so a legitimate
    opening-balance import (as-of date legitimately outside the period) is NOT rejected. The main flagged
    risk is closed.
  - **Payroll (`0167`) + inventory (`0180`) — correct AS WRITTEN, one residual operational edge.** Both set
    `entry_date` from data (payroll `pay_date`, inventory `current_date`) and take a caller-supplied period.
    Because GL/reporting views aggregate by `entry_date`, the only consistent period is the one CONTAINING
    that date, so the containment check is correct and a mismatch it rejects is genuinely the H1 mis-call.
    **Edge to confirm before apply:** these depend on the *caller* passing the period that contains the
    date. At a period boundary — inventory posts `current_date` but the resolver hands it a prior still-open
    period, or today's period row isn't created yet — a legitimate post would be rejected. Not a trigger
    defect; a precondition on the period-resolution logic (period rows must track the calendar).
    - **Inventory caller — FIXED (`042da195`, independent of 0196).** The route offered an arbitrary open
      period (`status=open limit(1)`, no date filter/order) as the inventory default; a today-dated entry
      could default into a non-containing open period (latent now, rejected under 0196). Now selects the
      open period CONTAINING today. No-op for the default year period; correct for monthly books.
    - **Payroll caller — FIXED (`6e059143`).** The client posted to `periods[0]` (most-recent open period,
      arbitrary vs the run's `pay_date`). Now selects the open period CONTAINING `pay_date`. This aligns the
      period to the already-coded cash-basis `entry_date = pay_date`; it does NOT decide accrual-vs-cash (see
      below). Undefined when no open period contains `pay_date` → the existing "No open period" guard blocks
      the post rather than posting to a wrong period.
  - **Complete client-caller sweep (2026-07-27) — the bug exists ONLY where `entry_date` is not derived from
    the chosen period, so the containment trigger can disagree with it:**
    - Inventory (`current_date`) — was arbitrary-period → FIXED (`042da195`, contain today).
    - Payroll (`pay_date`, user-editable) — was arbitrary-period → FIXED (`6e059143`, contain pay_date).
    - **Assets — SAFE, no fix.** `0166` dates the entry at `v_pstart` = the CHOSEN period's own `start_date`
      (read from `fin_periods where id = p_period_id`), so `entry_date ∈ [start,end]` is automatic no matter
      which period the client's `periods[0]` picks. Containment is structural.
    - Opening-balances — trigger-EXEMPTED (`opening_batch:%`), confirmed above.
    - **Net: every app UI posting path is now 0196-safe** (none will break on apply). The only remaining
      mismatch route is a finance user calling `fin_post_entry` / `fin_reverse_entry` / `fin_post_payroll_run`
      DIRECTLY via PostgREST with a deliberately mismatched period — which is exactly the deliberate
      internal-actor case 0196 is designed to reject. So fixed-UI + 0196 = UI never breaks AND the direct-RPC
      abuse is blocked. **The one open item is the accrual-vs-cash accounting DECISION** (below), not a code gap.
  - **Accrual-vs-cash (founder decision, unchanged by the fixes above).** Both fixes align the period to the
    EXISTING cash-basis `entry_date` (inventory = today, payroll = pay_date). If the founder wants payroll
    recognized in the period WORKED (accrual), that changes `entry_date` to `period_end` AND the period
    selection together — a coordinated change to flag, not something the containment fixes preempt.
  - **Net:** the drafted 0196 is safe to apply for the manual-journal + reversal paths it targets and does
    not over-reject opening balances; the only thing to confirm operationally is the payroll/inventory
    caller's period resolution at boundaries. Verification is static (SQL still not executed on a real DB).

## Bottom line
Application layer sound (no RLS bypass, no float money-math). DB layer: balance, immutability, and tenant
isolation are all DB-enforced and sound. **One material finding: H1** — the closed-period gate is enforced
against `period_id` rather than `entry_date`, leaving the manual `fin_post_entry` RPC able to post a
closed-period-dated entry. UI-unreachable today, reachable by a deliberate internal actor via direct RPC.
MEDIUM. Recommend the date∈period containment check.
