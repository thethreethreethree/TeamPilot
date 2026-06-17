# New-Tenant Go-Live Checklist

> What you (the operator) need to verify, deploy, and configure before
> opening ELOSTATE signups to real new companies.

This doc is the runbook that pairs with commits 1-3 of the new-tenant
onboarding work (`6c3a22c`, `9b3a0f3`, this commit). It's deliberately
short — every item is binary (done / not done) so a "ready to ship?"
check takes 60 seconds.

---

## 0. Pre-flight: code is on `main`

```
git fetch && git log --oneline origin/main | head -5
```

You should see:

```
... feat(tenant): go-live checklist + smoke verification (3 of 3)
9b3a0f3 feat(tenant): atomic onboarding completion (2 of 3)
6c3a22c feat(tenant): bootstrap triggers — new companies are operational on signup (1 of 3)
```

If any of those commits are missing, stop. Get them merged first.

---

## 1. Apply the two new migrations to production Supabase

Order matters:

```
supabase/migrations/0045_tenant_bootstrap_triggers.sql
supabase/migrations/0046_complete_onboarding_rpc.sql
```

Easiest path: Supabase dashboard → SQL editor → paste each file's
contents → Run. Or `supabase db push` from the project root if you have
the CLI wired.

**Verify they applied:**

```sql
-- 0045 triggers should be installed:
select tgname from pg_trigger
where tgname in (
  'trg_care_tenant_config_on_new_company',
  'trg_care_agent_state_on_new_agent_ins',
  'trg_care_agent_state_on_new_agent_upd'
);
-- Expect 3 rows.

-- 0046 RPC should exist:
select proname from pg_proc where proname = 'complete_company_onboarding';
-- Expect 1 row.
```

---

## 2. Defensive backfill is in 0045 — verify it ran

The bootstrap triggers fire on NEW inserts going forward. Migration 0045
also includes a one-time backfill for any companies that slipped in
between the original 0038/0042 backfills and 0045. Verify:

```sql
-- Every company should have a care_tenant_config row.
select c.id, c.name
from companies c
left join care_tenant_config t on t.company_id = c.id
where t.company_id is null;
-- Expect 0 rows.

-- Every agent-eligible profile should have a care_agent_state row.
select p.id, p.full_name, p.role
from profiles p
left join care_agent_state s on s.agent_id = p.id
where p.company_id is not null
  and (
    coalesce(p.is_support_agent, false)
    or p.role in ('CEO', 'COO', 'admin')
  )
  and s.agent_id is null;
-- Expect 0 rows.
```

If either query returns rows, the backfill failed silently — investigate
before opening signups.

---

## 3. Supabase Auth settings (configure in dashboard, not code)

These can't be set from this repo; you set them in the Supabase project
dashboard under Authentication → Settings. The minimum for go-live:

| Setting | Value | Why |
|---|---|---|
| **Confirm email** | Required | Stops a user signing up with someone else's email. Without this, anyone can sign up as `ceo@a-competitor.com` and you'd be liable. |
| **Minimum password length** | 8+ | Default is 6; bump to 8 minimum. |
| **Disable signups via the URL** | Off | We want public signups. Leave this OFF (signups enabled). |
| **Rate limiting** | Default OK | Supabase ships sane defaults. If you see abuse, tighten. |
| **Site URL** | `https://elostate.com` | Used for password reset and email-confirm links. Must match the production domain. |

---

## 4. Smoke test the end-to-end flow

After the migrations are in and Auth settings are correct, test a real
signup once before opening to the public:

1. Use a fresh email address (one Supabase has never seen)
2. Visit `https://elostate.com/login`
3. Click "Set up ELOSTATE"
4. Fill email + password → submit
5. Check the inbox for the confirmation email → click the link
6. Sign in with the new credentials
7. Onboarding wizard should appear (4 steps)
8. Complete the wizard → should redirect to `/dashboard`
9. Verify in Supabase Studio:
   - 1 new row in `companies` with the name you typed
   - 1 row in `company_brain` with that company_id (trigger 0007)
   - 1 row in `care_tenant_config` with that company_id (trigger 0045)
   - 1 row in `care_agent_state` for your user (trigger 0045)
   - `profiles` row updated: company_id set, role='admin', full_name set
10. Click around the dashboard — every left-nav item should load without
    a 500. Empty states are expected (no data yet); errors are not.
11. Open `/dashboard/care` — should load the C.A.R.E inbox (empty list)
12. Open `/dashboard/care/settings/widget` — should show the new
    tenant's auto-generated embed token

If any step fails, capture the error and fix before opening signups.

---

## 5. What's still missing for a full SaaS — not blocking go-live

For honesty, here's what the system DOESN'T do yet that a polished SaaS
typically would. None of these block "operational" — they're polish.

- **No billing / plan tiers.** Anyone who signs up gets the 'pilot'
  plan with a 200 conversation/month quota (column default). The quota
  isn't currently enforced anywhere; it's just a number on the row.
  Adding enforcement + Stripe is its own future work.
- **No team-invite step in the wizard.** New CEOs sign up alone. They
  invite teammates via the existing `/invite/[code]` UI after they're
  in the dashboard.
- **No C.A.R.E product-context step in the wizard.** The new tenant's
  `ai_product_context` starts NULL. Jeff defaults to "let me bring in
  a teammate" on every customer question per the AMD-006 prompt
  discipline shipped earlier today — which is the safe default, but
  means C.A.R.E isn't truly useful until the tenant goes to Settings
  and fills in product context.
- **No empty-state walkthroughs.** Fresh dashboards show empty modules.
  The product is operational; the UX is bare.
- **No domain / origin verification at C.A.R.E embed time.** New tenants
  have `allowed_origins=[]` so the widget can't be embedded until they
  explicitly add a domain in settings. This is fail-safe (no random
  embeds) but means a tenant who skips that step gets confused why
  their widget doesn't load.

If you want any of these to land before go-live, tell me and I'll scope
the work. Per the original directive — "operational, not demo, no
billing" — none of them are required to open signups.

---

## 6. Rollback plan

If a real signup goes wrong in production after go-live:

1. **Inspect** — look at the user's row in `profiles`. If `company_id`
   is set, the RPC succeeded. If NULL, the RPC failed and they should
   be able to retry from `/onboarding`.
2. **Clean up orphan tenants** — should not happen with the 0046 RPC,
   but if you see a company with no profiles attached:
   ```sql
   select c.id, c.name from companies c
   left join profiles p on p.company_id = c.id
   where p.id is null;
   ```
   Delete the company; the cascade will clean up its rows.
3. **Disable signups urgently** — if there's a critical bug, Supabase
   dashboard → Authentication → Settings → toggle "Enable Signups" OFF.
   Existing users can still sign in; new signups are blocked.

---

## 7. Sign-off

When everything above is done and verified:

- [ ] Both migrations applied to production
- [ ] Backfill queries returned 0 rows
- [ ] Supabase Auth settings configured
- [ ] One fresh end-to-end test signup completed without errors
- [ ] Onboarding wizard sets all 5 expected DB rows correctly
- [ ] Every dashboard page loads without 500s

You're ready to open signups.
