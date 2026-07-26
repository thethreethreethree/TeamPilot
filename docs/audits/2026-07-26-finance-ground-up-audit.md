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

- **Document/subledger paths are IMMUNE** — `fin_approve_bill`/`fin_issue_invoice`/`fin_approve_expense`/
  AP-pay/AR-receipt/credit-note/reconcile all resolve the period *from the document date* and require an
  OPEN period that CONTAINS that date (e.g. `0147:126-129` `where status='open' and v_date between
  start_date and end_date`). They cannot mis-date into a closed period.
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
    they can't be defeated the same way. **The class is bounded to finance manual-posting/reversal paths
    (2 instances), both closed by the one BEFORE-posted containment trigger.**
- **Recommended fix (§A27/A31 — enforce the invariant at the chokepoint, not via caller discipline):**
  add an `entry_date ∈ [period.start_date, period.end_date]` containment check. Cleanest as an additive
  BEFORE-trigger on `fin_journal_entries` that fires on the transition to `status='posted'` (matching the
  existing T-19 timing so drafts and the already-safe document paths are unaffected), OR inside
  `fin_post_entry` alongside T-19. **A single BEFORE-posted trigger on `fin_journal_entries` fixes the
  whole class at once** — it covers the second confirmed instance too. **Flagged, not built:**
  it's a behavior change on the core ledger posting path (which entries get rejected) that needs live-DB
  verification + founder review; the consistent finance-change discipline here is flag + ready fix, apply
  under the founder's eye (same as the FX-rounding flag). Ready to write the migration + test on the word.

## Bottom line
Application layer sound (no RLS bypass, no float money-math). DB layer: balance, immutability, and tenant
isolation are all DB-enforced and sound. **One material finding: H1** — the closed-period gate is enforced
against `period_id` rather than `entry_date`, leaving the manual `fin_post_entry` RPC able to post a
closed-period-dated entry. UI-unreachable today, reachable by a deliberate internal actor via direct RPC.
MEDIUM. Recommend the date∈period containment check.
