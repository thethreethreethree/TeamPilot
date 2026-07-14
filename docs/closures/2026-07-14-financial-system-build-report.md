# Financial System — honest build report

**Session:** 2026-07-14 · **Migrations `0157`–`0182`** · **54% → 96%** (81 of 84 features BUILT)

This report is written to the terms the founder set:

> *"What was actually built (file by file), which framework clauses each part satisfies, anything you could
> not complete, anything you changed from my request and why, and anything you are uncertain works. Do not
> report success for code you have not verified. Do not describe intended behavior as if it were confirmed
> behavior. If something is untested, say 'untested.'"*

---

## 0. THE HEADLINE, BEFORE ANYTHING ELSE

**Nothing in this report has touched a live database.**

No trigger has fired. No RPC has been called. No route has served a request. No page has rendered in a
browser. **26 migrations are unapplied** (`0157`–`0182`). Every "it does X" below means *the code says X and
the code compiles* — nothing more.

`BUILT` means the code and its acceptance script exist. `TESTED` means someone ran them against a real
database. **Nothing here is TESTED.** Only you can change that.

**And I shipped a security bug in this session.** See §4 — read it before you apply anything.

---

## 1. WHAT WAS BUILT, FILE BY FILE

### Migrations (29 added this session; `0157`–`0182` are the unapplied finance batch)

*Three more (`0154`–`0156`) were security pins built earlier in the session and are already applied.*


| File | What it does |
|---|---|
| `0157_fin_spend_limits.sql` | Approval limits per role; DB triggers on the `→approved` transition |
| `0158_fin_payment_schedules.sql` | Scheduled payments + aggregate over-schedule guard |
| `0159_fin_dunning.sql` | Collections ladder; append-only dunning events |
| `0160_fin_corporate_cards.sql` | Card statement import + match (mirrors 0145 bank recon) |
| `0161_fin_mileage_perdiem.sql` | Effective-dated rates; **amount derived by trigger**, never client-supplied |
| `0162_fin_expense_policies.sql` | Policy caps/receipts/disallowed, enforced by DB trigger on the line |
| `0163_fin_reconcile_create_entry.sql` | Create+post+match the missing entry for an unexplained bank line |
| `0164_fin_cash_flow_statement.sql` | Cash-flow statement; **`unclassified` bucket surfaced, never absorbed** |
| `0165_fin_kpis.sql` | Burn, runway, DSO, margins — **every ratio NULL, not 0, when undefined** |
| `0166_fin_fixed_assets.sql` | Register + depreciation with a **salvage clamp**; disposal posts all four legs |
| `0167_fin_payroll.sql` | Ledger-side payroll; **gross = net + withholdings as an identity**, employer tax on top |
| `0168_fin_approval_delegation.sql` | Delegation; authority re-checked **at use time** |
| `0169_fin_opening_balances.sql` | Trial-balance import; **imbalance surfaced in OBE 3900, never plugged** |
| `0170_fin_contractors_1099.sql` | 1099 on a **cash basis**, base-currency, posted payments only |
| `0171_fin_report_builder.sql` | Custom reports — **no stored SQL**; tenant hard-wired, not a parameter |
| `0172_fin_report_schedules.sql` | Scheduled delivery; **recipient is a member, authority re-checked at send time** |
| `0173_fin_overhead_allocation.sql` | **Analytical** overhead allocation (founder-confirmed); unallocatable is named |
| `0174_fin_spend_anomalies.sql` | Threshold gaming, split bills, new-vendor payments, SoD breach. **No score, no model** |
| `0175_fin_cash_forecast.sql` | Committed-obligations forecast + **the uncommitted gap, stated** |
| `0176_fin_unit_economics.sql` | Break-even — **NULL when contribution margin is negative** |
| `0177_fin_segment_and_idle.sql` | Net profit by segment; idle resources reported as **fact, not verdict** |
| `0178_fin_integrity_check.sql` | 7 post-restore assertions; **an unverified restore is not a recovery** |
| `0179_fin_cost_per_outcome.sql` | Cost per **durable** resolution; money spent on fixes that **came back** |
| `0180_fin_inventory.sql` | Inventory + COGS + shrinkage. Weighted average, perpetual (founder-confirmed) |
| `0181_fin_invoice_cogs_link.sql` | **Revenue and its cost now post together, or neither posts** |
| `0182_fin_variance_alerts.sql` | Makes `variance_alert_pct` real — it was dead config that flagged nothing |

### Acceptance SQL (21 files, `docs/financial-system/tests/`)
`0157` · `0158-0160` · `0161` · `0162` · `0163` · `0164` · `0165` · `0166` · `0167` · `0168` · `0169` ·
`0170` · `0171` · `0172` · `0173` · `0174` · `0175` · `0176` · `0177` · `0180` · `0181`

**None have been run.** They are written to be run by you, against staging, with `0116`–`0182` applied.

*(Counts in this section are derived from `git diff --diff-filter=A`, not from memory. My first draft said
"24 migrations, 18 acceptance files, 20 routes, 16 surfaces" — three of those four were wrong. In a report
whose entire purpose is not over-claiming, the counts have to come from the tree.)*

### API routes (26 added)
`/api/finance/` — `rates` · `expense-policies` · `roles` · `cards`(+`import`,`automatch`) · `ap/schedules` ·
`ar/dunning` · `bank/transactions/[id]/create-entry` · `statements/cash-flow` · `kpis` · `assets` ·
`payroll` · `delegations` · `opening-balances` · `contractors` · `reports`(+`schedules`,`deliver-cron`) ·
`anomalies` · `forecast` · `unit-economics` · `segments` · `cost-per-outcome` · `integrity` · `inventory`

### UI surfaces (16 added)
`controls` · `cards` · `collections` · `schedules` · `assets` · `payroll` · `opening-balances` ·
`contractors` · `reports` · `anomalies` · `forecast` · `unit-economics` · `segments` ·
`cost-per-outcome` · `integrity` · `inventory` — all wired into `FinanceNav`, plus `KpiStrip` and the
cash-flow section on `/statements`.

### Tooling (the part I'd defend hardest)
- `scripts/rls-audit.mjs` — **now detects views that bypass RLS** (+5 regression tests)
- `scripts/invariant-audit.mjs` — **new**, three invariants this codebase had already paid for and recorded
  only in prose: CSV-export safety (CWE-1236), no service-role in a finance route, and **reachability** —
  a finance column with no write path now **fails CI** (+7 tests)
- Both wired into `npm run check` **and CI**

**This is the part I would keep if I had to throw the rest away.** Every feature above is a thing the system
does. These are the things it *can no longer silently stop doing*.

---

## 2. WHICH FRAMEWORK CLAUSES EACH PART SATISFIES

| Clause | Where it bit |
|---|---|
| **§3.4 — no instant results; honesty is the moat** | The forecast refuses to extrapolate. OBE refuses to plug. Break-even refuses to divide. KPIs return NULL, not 0 |
| **§3.5 — measure consequence, not agreement** | Cost-per-outcome counts only resolutions that **held** — the whole feature |
| **§3.1 — append-only** | Dunning events, delivery log, inventory movements: `do instead nothing` RULES that bind the service role |
| **§3.2 — the gate is structural** | Every control is a DB constraint or trigger, never a UI check |
| **§A23 — authz columns DB-frozen** | `created_by` pinned + frozen on every new table; delegation's write gate *is* the feature |
| **§A25 — a false match is worse than a miss** | Anomaly detection has no score. The view-leak checker was rewritten when it raised 6 false positives |
| **§A26 — a bug is a class; sweep to the boundary** | The view leak (19 views), the CSV parser, the table-name errors — each swept, not spot-fixed |
| **§A28 — check for a codebase precedent** | `problem_id` follows `project_id` (0147). Cards mirror bank recon (0145) |
| **§2.2.3 — confirm the data model first** | I refused to write Phase-4/5 code until you confirmed. Both proposals are on record |
| **§1.5.2 — proactive audit** | The §1.7 sweep for "learned once, never encoded" invariants → `invariant-audit.mjs` |

---

## 3. WHAT I COULD NOT COMPLETE

**Three features, all needing your decision — not my code:**

1. **Scenario modelling.** I recommend building it *after* the forecast is in real use. A scenario tool with
   nothing solid to overlay is a spreadsheet with extra steps.
2. **Multi-entity / consolidation.** A large structural change. Do you actually operate multiple legal
   entities? If not, this is speculative complexity.
3. **Integration layer** (Stripe / Plaid / QuickBooks). Which one first, if any?

**Also unfinished:**
- **`.xlsx` export** — needs a new dependency. CSV works today. Your call.
- **The delivery cron is dormant** — needs `CRON_SECRET` + a `vercel.json` entry. Operator step.

---

## 4. WHAT I GOT WRONG

### 🔴 I shipped a cross-tenant data leak in 19 views

**HIGH severity. Not exploited** — every affected migration is unapplied. **Fixed before you apply.**

A Postgres view runs with its **owner's** privileges unless declared `with (security_invoker = true)`. Views
without it **read base tables without applying the querying user's RLS policies.** `fin_1099_worksheet`
would have exposed **every tenant's contractor names, taxpayer IDs and payment totals** to any authenticated
user of any company.

**`rls:audit` was green the entire time** — correctly, by its own logic. Every underlying *table* was
protected. **The hole was in the lens, not the data.**

**And this codebase had already learned it.** `0052_views_security_invoker.sql` exists for exactly this
reason. The lesson was learned, written into a migration, **and never encoded in a check.** So I re-broke it
nineteen times while the gate reported green.

The fix that matters is not the 19 views. It's that **`rls:audit` now checks views**, and
**`invariant-audit.mjs` now guards the other two "learned once, never encoded" rules** I found by sweeping.

### 🟠 SEVEN features were BUILT and INVISIBLE — one blind spot, seven times

This is the finding I would most want a reviewer to see, because it is about **how I work**, not about a bug.

I shipped features whose **schema was correct, whose views were correct, whose pages were correct** — and
which **could never have worked**, because nothing in the product could write the column they depended on.
**I had already reported three of them as `BUILT`.**

| What | What it actually meant |
|---|---|
| Controls page | No nav entry. Unreachable. |
| `0181` invoice→stock link | No picker. **COGS could never fire.** |
| `0179` `problem_id` | No write path anywhere. **Cost-per-outcome would read "0% tagged" forever.** |
| `0159` dunning ladder | Could record a chase, never *create* the ladder. **Collections sat empty, looking healthy.** |
| **`cost_type`** | **Severe.** Defaults to `'none'`, nothing could set it → **break-even treats every cost as fixed and prints a plausible, wrong number**; overhead allocates to nobody; project margins show zero direct cost. **Three analytics features degraded to confident nonsense by one unreachable column.** |
| `fin_exchange_rates` | The confirmed parameter was "manual FX" — **and there was no way to enter a rate at all.** |
| `variance_alert_pct` | Dead config since `0149`: nothing wrote it, **nothing read it either.** A settings column that *implies* a working control and flags nothing. |

**And the last one lands hardest:** I wrote a gate to catch *"a column nothing writes"* — and then shipped
`0182` with **a column nothing reads.** The blind spot is the seam, and it runs in both directions.

**All seven are fixed**, and `invariant:audit` now **fails CI** on the class.

**The honest reading: that is not seven accidents. It is one blind spot, seven times.** I audit the database
carefully and trust the seam between the database and the screen. The only durable fix was to stop trusting
myself and write the gate.

### Other errors, all caught before shipping
- **`0159` filtered on invoice statuses that don't exist** — the collections list would have been
  permanently empty *and looked healthy*
- **CSV parser split `"$10,000.00"` on its own thousands separator** → a £10,000 balance would have imported
  as **£10**, as a *valid* row
- **Five table/column names I'd assumed rather than checked** (`fin_bills.total`, `fin_entry_lines`,
  `source_bill_id`, `fin_depreciation_runs`, `fin_project_margin`) — each would have failed at apply time
- **Controls page shipped with no nav entry** — unreachable; my own AMD-006 Layer-3 failure
- **My own SELECT rule in `rls-audit` was dead code** — a regex that could never match, while reporting green

### And one that touched your tree
**My `git add -A` committed your uncommitted `0118_fin_ledger.sql` work** under my commit message (`dd85b4f`).
99 lines, unreviewed. Nothing lost — but it's attributed to me. **I did not revert it**: unpicking a pushed
commit would be a second unreviewed change on top of the first. **Your call.** The lesson is applied: stage
what I wrote, never `-A`.

---

## 5. WHAT I CHANGED FROM YOUR REQUEST

**Nothing silently.** Every deviation was surfaced and confirmed:

- **Phase-4 overhead:** I proposed **analytical** (views only) over **posted** allocation, and you confirmed.
- **Phase-5 forecast:** I argued *against* trend extrapolation and recommended committed-obligations + gap.
  You confirmed.
- **Inventory:** weighted-average + perpetual — both asked, both confirmed, before a line was written.
- **Scenario modelling:** I deferred it *with a stated reason* rather than building it thin.

---

## 6. WHAT I AM UNCERTAIN WORKS

Honestly: **all of it, in the sense that none of it has run.** But specifically —

1. **`fin_cash_forecast`'s running-balance window.** I rewrote it once because the first version was
   unreadable. The logic is simple now, but a cumulative window over a generated date series is exactly the
   shape that produces an off-by-one at the boundaries. **Test it with a known dataset.**
2. **The 0173/0177 overhead allocation.** The `bool_and(... is not null)` guard is doing subtle work — that a
   *single* unallocatable month makes the whole segment's net NULL. I believe that's right (better silent
   than flattering), but it may be **stricter than useful** in practice. Watch it.
3. **`fin_inventory_check` reconciliation.** It sums *all* movements against `qty_on_hand`. If a future
   migration adds a movement kind that doesn't change quantity, this will report a false discrepancy.
4. ~~**The 0180 sell path posts COGS only.**~~ **FIXED in `0181`** (founder-confirmed): revenue and its cost
   now post in the same transaction, or neither posts. An invoice for stock you don't have fails entirely.
   **New known gap in its place:** a **credit note does not return stock to inventory**. Correct for a
   services credit note; wrong for a returned physical good. Whether a credit note implies a physical return
   is a business decision, so it is flagged, not assumed.
5. **Trigger ordering in 0161→0162** depends on alphabetical trigger names. Verified by reading; **not
   verified by running.**

---

## 7. WHAT TO DO NEXT

1. **Apply `0157`–`0182`** to staging. (The security fix is in this batch.)
2. **Run the 19 acceptance files.** That is the only path from `BUILT` to `TESTED`.
3. **Rule on three decisions:** scenario modelling, multi-entity, integrations.
4. **Decide on `0118`** — keep my accidental commit, or let me revert it.
5. **Wire the delivery cron** if you want scheduled reports.

**The recurring finding of this entire session, in one sentence:**

> Every real defect in a double-entry system **balances perfectly.** A backwards reconciliation entry, a
> misclassified cash-flow section, a `NULL` limit meaning *unlimited*, a `0` runway meaning *incomputable*,
> employer tax folded into gross, a forged delegation with a flawless audit trail, a 100% gross margin, a
> break-even target that instructs you to grow toward the wall. **The balance assertion catches none of
> them.** They are stopped only by designs that **refuse** — refuse to ask the user for a direction, refuse
> to absorb a remainder, refuse to invent a number, refuse to accept a field, refuse to print a figure.
