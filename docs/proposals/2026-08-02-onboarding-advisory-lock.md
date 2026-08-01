# Proposal — Close the onboarding double-create race (per-user advisory lock)

> Status: **PROPOSAL — not applied.** Founder trigger: `"onboarding RPC advisory lock"`.
> Author: autonomous session 2026-08-02. This edits the crown-jewel account-creation path, so per §3.3
> (propose, don't overtake) it's designed for your approval, not shipped. Founder flagged it HIGH.

## 1. The bug (verified in the RPC)

`complete_company_onboarding()` (`supabase/migrations/0047_onboarding_with_product_context.sql:48`) is a
check-then-create with NO lock:

```sql
-- line 80-85: idempotency short-circuit
select company_id into v_existing_company_id from profiles where id = v_user_id;
if v_existing_company_id is not null then
  return v_existing_company_id;
end if;
-- line 89-91: create a NEW company
insert into companies (name, industry, size, stage, goals) values (...) returning id into v_company_id;
-- line 93-96: attach the caller
insert into profiles (id, company_id, full_name, role) values (v_user_id, v_company_id, ..., 'admin')
  on conflict (id) do update set company_id = v_company_id, ...;
```

**The race:** two concurrent calls by the SAME user (double-click / double-submit / a retried request) both
read `v_existing_company_id` as NULL (neither has committed the profile attach yet), so **both run `insert
into companies`** → two companies created. The `profiles` insert is idempotent (PK `id` + `on conflict`), so
the user's profile ends pointing at ONE company (last writer) — but the OTHER company is an **orphaned ghost**:
a real `companies` row with no member, plus whatever the provisioning step (line ~100-108) attached to it.

This is the app-wide re-entrancy class's one path that a client-side `useRef` latch CAN'T fully close — a
determined double-submit, a proxy retry, or two tabs still races at the DB. The durable fix belongs in the RPC.

## 2. The fix — one line: a per-user transaction advisory lock

Add, immediately after the auth check (`v_user_id` is known, line ~69), before the existing-company read:

```sql
-- Serialize concurrent onboarding for the SAME user. Transaction-scoped: auto-released on commit/rollback.
-- The lock key is the user id, so it never blocks different users. After this, two concurrent submits run
-- one-at-a-time; the second sees v_existing_company_id set and short-circuits to the first's company.
perform pg_advisory_xact_lock(hashtext(v_user_id::text));
```

Why this is the right primitive:
- **`pg_advisory_xact_lock`** (not `pg_advisory_lock`) is bound to the transaction and released automatically
  at commit/rollback — no leak risk if the function errors mid-way. The RPC already runs in a single implicit
  transaction (the migration's own comment at line ~130 says "in a transaction").
- **Keyed on the user id** (`hashtext(v_user_id::text)` → int4, widened to the bigint single-key form).
  Different users never contend; the same user serializes. **Verified 2026-08-02: this is the ONLY advisory
  lock in the entire migration set** (`grep pg_advisory supabase/migrations` → none), so the single-key form
  is collision-free — the two-int `pg_advisory_xact_lock(namespace, key)` form is NOT needed here; adopt it only
  if a second advisory-lock feature is ever introduced. Keep the fix minimal.
- It composes with the existing idempotency check — the second caller, unblocked after the first commits,
  reads the now-set `company_id` and returns it. Net effect: exactly one company per user, always.

### Alternative considered (and why the lock is better)
A partial unique index "one company per creator" doesn't fit — `companies` has no creator column and legitimately
has many members, so there's no natural key to make unique. Tracking creator just to constrain it is more schema
than the lock. The advisory lock is the minimal, self-contained fix.

## 3. Blast radius + test/rollout

- **Blast radius:** one added line inside one RPC; behaviour is identical for the normal (non-concurrent) path.
  No schema change, no new columns, no data migration. Idempotent re-run of the migration (create-or-replace).
- **Test:** (a) a pgTAP / integration test firing two `complete_company_onboarding` calls for the same user
  concurrently and asserting exactly ONE `companies` row results (today it's two); (b) confirm a normal single
  call still onboards; (c) confirm two DIFFERENT users onboard concurrently without blocking each other.
- **Rollout:** apply via `npm run db:apply` after staging verification of the concurrent test. Low risk — the
  lock only adds serialization on the same-user hot path, which is already meant to be one-shot.

## 4. Relationship to the client-side fixes already shipped

The 2026-08-01 re-entrancy sweep latched the onboarding SUBMIT button client-side (a `useRef` guard), which
stops the common double-click. This proposal closes the residual SERVER race that a client latch can't cover
(retries, multiple tabs, a proxy replay). Together they make the guarantee — one company per user — true at
both layers. Prod blast-radius check (2026-08-01, read-only) found the onboarding path had NOT yet produced a
duplicate company in practice, so this is preventive, not a cleanup — no existing ghost-company remediation is
bundled here (if a future audit finds orphaned companies, that's a separate one-time cleanup).
