# CHECK - Multi-factor sign-in

## Commands

```
npx vitest run --maxWorkers=1 src/lib/auth/__tests__/mfa.test.ts → 8 passed, exit 0
npx vitest run --maxWorkers=1 src/app/api/me/mfa/verify/__tests__ → 7 passed, exit 0
npx tsc --noEmit -p . → exit 0
```

PGlite replay of 0309 on the repo's Supabase shim (a table with an owner policy, a deny-all table with none):

```
policies: notes mfa_required RESTRICTIVE, storage.objects mfa_required RESTRICTIVE   (the deny-all table: none)
no MFA, aal1      : read 1, insert ok
MFA on, aal1      : read 0, insert refused (new row violates row-level security policy "mfa_required")
MFA on, aal2      : read 2, insert ok
MFA off flag, aal1: read 3, insert ok
exit 0 (ran twice: re-runnable)
```

Production (2026-11-23):

```
npm run db:apply → applying 0309_mfa_required_policies.sql … ok · DB now at 0309
✓ PASS  multi-factor sign-in holds in the database: every table that grants access has the mfa_required policy (0309)
✅ ALL 32 invariants hold.  (exit 0)
select count(*) from pg_policies where policyname = 'mfa_required' → 190
```

No account carries app_metadata.mfa yet, so 0309 changes no one's access until a person turns codes on. Two live
invariants that judge policy scoping (finance company scope, Macro-Mode owner term) now consider PERMISSIVE policies
only: a restrictive policy can only narrow access, and mfa_required would otherwise read as "not company-scoped".

## Findings

### F1 - owner-rights database functions are outside the database rule
class: SECURITY DEFINER functions callable by `authenticated` run as their owner, so RLS — and 0309's restrictive policy
— does not apply inside them; an aal1 token of an MFA account can still call them over the REST API.
sweep: `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace and n.nspname='public' where p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')` → 128
severity: medium
Most are small helpers used inside policies (auth_company_id, admin_roles…) or actions that check auth.uid() themselves;
none returns another company's data. Pages and every /api route are guarded, and tables and storage are guarded. Filed
as the next step: add `rss_mfa_ok()` to the functions that read or write customer data, with a live invariant.

### F2 - the mobile app and Chrome extension cannot ask for a code
class: a client that authenticates with a Bearer token but has no code step.
sweep: `grep -rn "auth.getUser(token)" src/lib/api` → resolveApiAuth.ts, extensionAuth.ts (both now refuse an aal1 token of an MFA account)
severity: low
Stated on the Settings panel before anyone turns codes on; filed for the mobile and extension builds.
