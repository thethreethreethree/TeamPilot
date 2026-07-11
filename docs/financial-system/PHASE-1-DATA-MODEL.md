# Phase 1 — Data Model Proposal (COA + Double-Entry Ledger)

**Status: PROPOSAL — awaiting founder confirmation. No implementation code / migrations written yet**
(FinancialSystem.md section 6.4). This document is the *what* and the *why*; on your confirmation it
becomes migrations + tests.

Build parameters (your answers, 2026-07-10): multi-tenant RLS per company · existing stack ·
money `numeric(19,4)` all math in SQL · manual FX now, API-ready · separate finance-role
dimension, approval gated to Executive/Admin · COMPLETE from-scratch double-entry GL · Supabase
platform encryption.

---

## 0. The shape of double-entry (the model in one paragraph)

Every financial event is a **journal entry** (a header) made of ≥2 **journal lines**, each line a
debit OR a credit against one **account**. The iron law: **within an entry, total debits = total
credits** (in base currency). Account **balances are never stored** — they are *derived* by
summing that account's posted lines (drill-down for free, and no balance can ever disagree with
its transactions). This is the same "state is derived by replaying an append-only log" discipline
the app already uses (section 3.1) — here the log is the ledger.

---

## 1. Tenancy & money conventions (apply to every table)

- **`company_id uuid not null`** on every table, `references companies(id)`. RLS mirrors the
  existing app: `company_id = auth_company_id()` for SELECT; writes additionally gated by finance
  role (below). This reuses the audited tenant machinery — no new isolation model.
- **Money = `numeric(19,4)`**, never `float`. 19 total digits, 4 decimal places (holds FX rates
  and per-unit costs precisely; statements round to 2 at *presentation*, never in storage). **All
  arithmetic happens in Postgres** (SUM, etc.); TypeScript treats money as a **string** end to end
  and never does `+`/`-` on it.
- **Currency = `char(3)`** ISO-4217 codes.

---

## 2. Chart of Accounts — `fin_accounts`

The configurable account tree.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| company_id | uuid not null | tenant |
| code | text not null | account number, e.g. "1000"; **unique per (company_id, code)** |
| name | text not null | "Cash — Operating" |
| type | text not null | CHECK in (`asset`,`liability`,`equity`,`revenue`,`expense`) |
| subtype | text null | finer bucket (e.g. `current_asset`, `cogs`) — config, not logic-bearing |
| parent_id | uuid null | self-ref → the tree / sub-accounts |
| normal_balance | text not null | CHECK in (`debit`,`credit`); **must match `type`** (asset/expense→debit; liability/equity/revenue→credit) via a CHECK |
| currency | char(3) null | null = multi-currency/base; set only for single-currency accounts (e.g. a USD bank account) |
| is_active | boolean not null default true | soft-disable; never hard-delete an account that has lines |
| is_system | boolean not null default false | protects built-ins (e.g. FX Gain/Loss, Retained Earnings) from deletion |
| created_at / created_by | | |

**Why a tree via `parent_id`:** sub-accounts and roll-ups (a "Marketing" parent summing its
children) are the universal COA shape; a self-ref adjacency list is the simplest correct model
and reports walk it recursively.
**Why store `normal_balance` when it's derivable from `type`:** it makes the sign convention
explicit at the row and lets a CHECK guarantee type↔normal-balance consistency — a wrong normal
balance is a silent whole-account error, so we pin it.

**Seed set:** on company finance-init we seed a minimal standard COA (Cash, AR, AP, Retained
Earnings, a Revenue and an Expense parent, FX Gain/Loss) as `is_system` where structural. Full
seed list proposed at implementation.

---

## 3. The ledger — `fin_journal_entries` + `fin_journal_lines`

### 3.1 `fin_journal_entries` (the header / transaction)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| company_id | uuid not null | |
| entry_no | bigint | per-company sequential human number (gap-free within a period) |
| entry_date | date not null | the accounting date (drives period) |
| period_id | uuid not null | → `fin_periods`; **must be an OPEN period to post** |
| description | text not null | |
| reference | text null | external ref (invoice #, etc.) |
| status | text not null | CHECK in (`draft`,`pending_approval`,`posted`,`void`) |
| source | text not null | (`manual`,`system`,`ap`,`ar`,`payroll`,…) — API-ready provenance |
| reversal_of | uuid null | → another entry; set when this entry reverses one |
| created_by | uuid not null | |
| approved_by | uuid null | **must differ from created_by** (SoD) once posted |
| posted_at | timestamptz null | |
| created_at | timestamptz not null | |

### 3.2 `fin_journal_lines` (the debits & credits)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| company_id | uuid not null | denormalized for RLS |
| entry_id | uuid not null | → entry, `on delete cascade` (only while draft; posted never deletes) |
| line_no | int not null | ordering |
| account_id | uuid not null | → `fin_accounts` |
| debit | numeric(19,4) not null default 0 | |
| credit | numeric(19,4) not null default 0 | |
| currency | char(3) not null | transaction currency |
| fx_rate | numeric(19,8) not null default 1 | txn→base rate used |
| base_debit | numeric(19,4) not null | debit × fx_rate, in base currency |
| base_credit | numeric(19,4) not null | credit × fx_rate |
| memo | text null | |
| cost_center_id | uuid null | reserved for Phase 4 (nullable now) |

**Per-line CHECKs:** `debit >= 0 and credit >= 0`; **exactly one of debit/credit is > 0**
(`(debit > 0) <> (credit > 0)`) — a line is a debit or a credit, never both, never neither.

---

## 4. The balance invariant — enforced at the DATABASE level (the crux)

FinancialSystem.md section 3: *"the ledger must always balance — enforce at the database level, not only
in application code."* Two layers, both in Postgres:

1. **A posting RPC — `fin_post_entry(entry_id)` (SECURITY DEFINER):** the only way to move an
   entry to `posted`. It (a) verifies the caller holds an approver/exec finance role and
   `approved_by <> created_by` (SoD), (b) verifies the period is OPEN, (c) computes
   `SUM(base_debit) = SUM(base_credit)` and `count(lines) >= 2`, and only then sets
   `status='posted', posted_at=now()`. Atomic — all-or-nothing.

2. **A deferred constraint trigger — `fin_assert_balanced`** on `fin_journal_lines`, fired
   **`DEFERRABLE INITIALLY DEFERRED`** so multi-line inserts are checked **at COMMIT**, not
   mid-insert. For every entry touched in the txn whose status is `posted`, it re-asserts
   `SUM(base_debit) = SUM(base_credit)`. This is the backstop that makes balance true even if a
   line is ever written outside the RPC — enforcement lives in the DB, not in app trust.

**Why both:** the RPC is the clean sanctioned path (validates role + period + balance together);
the deferred trigger is the structural guarantee that *no* code path — service-role, a future
import, a bug — can leave a posted entry unbalanced. Defense in depth on the one invariant that,
if violated, corrupts every downstream number.

---

## 5. Fiscal periods — `fin_periods` + closed-period immutability

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| company_id | uuid not null | |
| name | text not null | "2026-07" or "FY2026-Q3" |
| start_date / end_date | date not null | non-overlapping per company (enforced) |
| status | text not null | CHECK in (`open`,`closed`,`locked`) |
| closed_by / closed_at | | |

**Immutability:** a trigger on `fin_journal_entries` + `fin_journal_lines` **rejects any INSERT/
UPDATE/DELETE affecting an entry whose `period_id` is `closed`/`locked`.** Corrections to a closed
period are made by posting a **new** entry in an open period (a reversing/adjusting entry), never
by editing history (section 3 append-only). Closing a period is itself an RPC gated to controller/CFO.
`locked` = hard-locked after year-end (even admins can't reopen without an explicit unlock event).

---

## 6. Multi-currency — `fin_exchange_rates` + base currency

- **Base currency** lives on a per-company finance settings row (`fin_settings.base_currency`,
  default e.g. `USD` — you set it at finance-init).
- **`fin_exchange_rates`:** (company_id, from_ccy, to_ccy, rate `numeric(19,8)`, as_of_date,
  source `manual|api`, created_by). **Manual entry now**; the `source` column + a thin
  `RateProvider` interface (one method: `getRate(from,to,date)`) make it **API-ready** — swapping
  in an OpenExchangeRates/ECB feed later is a new provider, no schema change.
- **On each line** we store both the transaction-currency amount AND the base-currency amount
  (`base_debit/base_credit`), computed at post time from the rate. The **balance invariant is
  checked in base currency** (a EUR line and a USD line balance only after conversion).
- **FX gain/loss:** structurally supported now (a `system` FX Gain/Loss account is seeded);
  realized FX gain/loss entries are generated at settlement time in Phase 2 (AP/AR payment). Phase
  1 delivers the *structure* + manual rates + base-currency posting; I'll flag the settlement math
  when we reach payments.

---

## 7. Immutable audit trail — `fin_audit_log` (append-only)

Beyond the ledger's own append-only nature, a dedicated finance audit log:

| Column | Type |
|---|---|
| id, company_id | |
| actor | uuid (who) |
| action | text (`entry.posted`, `period.closed`, `account.created`, `rate.set`, …) |
| table_name, record_id | text/uuid (what) |
| before_value, after_value | jsonb (prior + new — the "prior value" section 4 requires) |
| occurred_at | timestamptz |

RLS: **INSERT-only** for the finance service path; **no UPDATE, no DELETE** (append-only rules
like the existing `problems`/`events` no-delete rules I audited). Written by the RPCs + triggers,
not client-editable. This is the "who changed what, when, and the prior value" requirement, and it
composes with — but is separate from — the diagnostic `events` chain (finance needs its own
regulator-grade before/after log).

---

## 8. Finance roles + Segregation of Duties — `fin_roles`

Your answer #5: separate finance-role dimension, permission-based, approval gated to Executive/Admin.

- **`fin_roles`:** (company_id, user_id, role) — role CHECK in
  (`viewer`,`accountant`,`approver`,`controller`,`cfo`). Separate from the platform
  `profiles.role` (CEO/COO/admin/Member) so we don't fragment that vocabulary further (the F4
  audit lesson) — finance authority is its own axis.
- **Capability matrix** (proposed — confirm):

  | Capability | viewer | accountant | approver | controller | cfo |
  |---|:-:|:-:|:-:|:-:|:-:|
  | View reports / drill-down | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Create/edit **draft** entries | | ✓ | ✓ | ✓ | ✓ |
  | **Approve & post** entries | | | ✓ | ✓ | ✓ |
  | Close/open periods | | | | ✓ | ✓ |
  | Configure COA / rates / settings | | | | ✓ | ✓ |

- **SoD enforced in the DB:** `fin_post_entry` rejects `approved_by = created_by`. The person who
  *enters* cannot be the person who *approves*, structurally — not merely by UI.
- **"Executive/Admin approval":** platform `admin`/CEO/COO map to `cfo`-equivalent finance
  authority by default (so an org can run without separately assigning finance roles), and the
  finance roles refine it. Confirm this bridge, or say finance roles must be assigned explicitly
  with no platform-role fallback.

---

## 9. Table inventory (Phase 1)

`fin_settings` · `fin_accounts` · `fin_periods` · `fin_journal_entries` · `fin_journal_lines` ·
`fin_exchange_rates` · `fin_audit_log` · `fin_roles`. All `fin_`-prefixed, company-scoped, RLS +
finance-role gated. Balances/trial-balance are **views** over posted lines (derived, never stored).

---

## 10. What I need you to confirm (before any migration)

1. **The overall model** (section 2–section 8) — especially the **two-layer DB balance enforcement** (section 4) and
   **derived balances / no stored balances** (section 0).
2. **Finance role set + capability matrix** (section 8) — the five roles and who-can-do-what.
3. **The platform-role → finance-role bridge** (section 8): do `admin`/CEO/COO auto-get CFO-level finance
   authority, or must finance roles be assigned explicitly?
4. **Base currency default** for a new company (e.g. `USD`?) — or is it chosen at finance-init per
   company (my lean: chosen at init, defaulting to USD).
5. **`entry_no` scope** — sequential per-company, or per-company-per-period? (Lean: per-company,
   monotonic; period shown separately.)

On your confirmation I'll write Phase-1 as migrations + tests in confirmed increments (COA →
periods → ledger + balance enforcement → currency → audit/roles), each with the calculation tests
section 3 requires, and update the manifest as each reaches BUILT/TESTED.
