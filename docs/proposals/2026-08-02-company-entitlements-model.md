# Proposal — Company entitlements model (paid multi-module + seat types)

**Status:** design-ready, awaiting founder go (billing/access substrate → §3.3, founder-gated).
**Date:** 2026-08-02
**Companion to:** `2026-08-02-coaching-stt-usage-metering.md` (usage metering). Metering answers
*how much was consumed*; entitlements answer *what the company is allowed to use and pay for*.
Together they are the two halves of the billing substrate the Phase-3 pricing rests on.

**Trigger:** The pricing charges per-module fees for **care + sales_coach + finance** with a
"all three → 20% off" bundle, plus per-seat-type lines (base / support-agent / coaching-rep).
The current substrate can't express any of that at paid scale:

| Pricing dimension | Current substrate | Gap |
|---|---|---|
| Multiple modules per company | `companies.access_module` — single `text`, one value | single-module only; no set |
| Finance / core as billable modules | check `in ('care','sales_coach')` | `finance` / `elostate` not representable |
| Support-agent seat | `profiles.is_support_agent boolean` (0034) | ✓ present, countable |
| Coaching-rep seat | none | no per-user coaching-rep designation |
| Base seat | every active profile | ✓ derivable |

## Critical constraint — do NOT weaken the pilot lock

`companies.access_module` (0207) is a **pilot access-control hard-lock**: middleware confines a
single-module pilot account to its one module, and **verify:live #23** guards it. Migration 0045
previously broke this by keying access on the wrong thing (`care_tenant_config` instead of the
column). Therefore the entitlements model must **extend** the lock, never replace or loosen it:

- The pilot lock stays authoritative for pilot accounts (single `access_module`).
- Paid accounts gain a **superset** entitlement record; access resolves to entitlements **if
  present**, else falls back to `access_module`. No pilot account loses its confinement.
- verify:live #23 must stay green (or be extended to assert the fallback), not deleted.

## Design — entitlements as append-friendly rows, seats as profile flags

### Modules: a set per company (not a scalar)
```sql
-- NNNN_company_module_entitlements.sql
create table if not exists company_module_entitlements (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id),
  module       text not null check (module in ('elostate','care','sales_coach','finance')),
  enabled_at   timestamptz not null default now(),
  disabled_at  timestamptz,                 -- soft-disable (append/close, never hard-delete: §3.1)
  unique (company_id, module)               -- one live entitlement row per module
);
-- entitled = row exists with disabled_at is null
```
Seeding: for each pilot company with a non-null `access_module`, insert one matching row so the
transition is lossless and the pilot lock's meaning is preserved.

### Seats: mirror the existing support-agent flag
```sql
alter table profiles
  add column if not exists is_coaching_rep boolean not null default false;
-- billable seat counts, per company:
--   base     = count(profiles)                      -- everyone
--   support  = count(profiles where is_support_agent)
--   coaching = count(profiles where is_coaching_rep)
```
A boolean on `profiles` keeps it symmetric with `is_support_agent` (0034) and makes seat-count a
trivial aggregate. Coaching sessions stay attributed by `agent_id`; the flag designates *who
holds a paid coaching seat*, which is the billable unit.

## Two concerns kept separate (don't conflate)

- **Access control** — what a user can reach. Enforced by middleware/RLS. `access_module` +
  entitlements drive this. Security-critical; the pilot lock is the floor.
- **Billing** — what the company is charged. A rollup over entitlements (module fees) + seat
  flags (per-seat lines) + usage events (metered minutes). Billing reads the substrate; it must
  never be the thing that *grants* access.

Conflating them is how you get "downgraded a plan → silently opened a module" bugs. Keep the
access decision keyed on the entitlement/lock, and let billing be a read-only rollup on top.

## Guards this must carry

- **Pilot lock intact** — verify:live #23 stays green; add a check that a pilot single-module
  account still can't reach a non-entitled module after entitlements land.
- **Tenant-pinned writes (INV15)** — entitlement + flag writes pin `company_id` from the
  authenticated context, never client input.
- **RLS** — company admins (CEO/COO/admin) read their own entitlements; no cross-company read.
- **Append discipline (§3.1)** — disable a module by stamping `disabled_at`, not by deleting the
  row, so the entitlement history is replayable (when did they add/drop Finance?).

## Not doing (scope guard)

- No live migration, no middleware rewire here — this is the design. The build (migration +
  access-resolution change + billing rollup) is founder-gated because it touches the security
  floor (the pilot lock) and billing.
- No pricing rates in this doc (IP discipline) — it's pure substrate.

**Green-light phrase:** `"build the entitlements model"`.

---

## ADDENDUM (2026-08-02) — the pricing pivoted to simple TIERS; this design SIMPLIFIES

The founder found the multi-module hybrid pricing too complex and pivoted to **simple client-facing tiers**
(delivered as `ELOSTATE-PRICING-SIMPLE-*.pdf`). This changes the entitlement shape — and makes it *easier*:

- **Under tier pricing, a company is on ONE tier, not a SET of modules.** So the entitlement is a single value
  — `companies.tier` ∈ (`starter`, `business`, `performance`) — much closer to the EXISTING single
  `companies.access_module` (0207) than the `company_module_entitlements` SET this doc designed. The set-based
  table above is now over-engineered for the chosen direction.
- **The two live pricing options differ only in how coaching is entitled:**
  - **Option A (pure 3 tiers):** entitlement = `companies.tier` alone. Feature access resolves from the tier
    (`performance` unlocks coaching; `business` unlocks care+finance; `starter` = base). Simplest possible.
  - **Option B (2 tiers + per-rep coaching add-on, RECOMMENDED):** `companies.tier` ∈ (`starter`,`business`)
    PLUS a per-rep `profiles.is_coaching_rep` flag (mirrors the existing `is_support_agent`, 0034) for the reps
    who have the coaching seat. This is the cleaner build — one company tier column + one profile boolean, both
    patterns already in the codebase.
- **Everything else in this doc still holds:** extend (don't weaken) the 0207 pilot lock (verify:live #23 stays
  green); tenant-pinned writes (INV15); RLS company-scoped reads; append/soft-disable over delete (§3.1);
  access-control vs billing kept separate.

**Net:** wait for the founder's A-vs-B choice, then build a single `tier` column (both options) + (option B) an
`is_coaching_rep` flag. Drop the `company_module_entitlements` SET table — the tier model doesn't need it. The
green-light phrase and gating are unchanged.

---

## Substrate verified against the tree (2026-08-02)

Before this proposal is greenlit, its factual premises were re-checked against the live migrations (not cached
labels) so the founder-gated build starts on confirmed ground:

- **`companies.access_module` (0207):** confirmed a single `text` column, `check (access_module is null or
  access_module in ('care','sales_coach'))`, null = full hub access. The tier `text` column is therefore a
  *separate, additive* column — it extends the lock, it does not replace it (the "don't weaken 0207" constraint
  above holds structurally, not just by intent).
- **`profiles.is_support_agent` (0034):** confirmed `boolean not null default false`. Option B's `is_coaching_rep`
  is a verbatim mirror of an existing, proven pattern — not a new shape.
- **`is_coaching_rep` and `companies.tier`:** confirmed **absent** everywhere in `supabase/migrations/` — both are
  clean forward-adds, no collision, no accidental reuse of an existing name.
- **Next migration number:** `0208` (latest applied is `0207`).

No code was written for this check — it only converts the proposal's cached claims into tree-verified facts, so
that "build the entitlements model" does not discover a wrong premise mid-build.
