# CHECK - Multi-factor sign-in for owner-rights functions

## Commands

PGlite replay of 0309 + 0315 (twice), first without and then with production's auth-schema grants:

```
MFA aal1  /rpc/fin_pay_bill : refused: Enter the code from your authenticator app to continue.
MFA aal1  /profiles (table) : allowed
MFA aal2  /rpc/fin_pay_bill : allowed
no MFA    /rpc/fin_pay_bill : allowed
anon      /rpc/pilot_code   : allowed
service   /rpc/fin_post     : allowed
no path set (direct SQL)    : allowed
authenticator setting: ["pgrst.db_pre_request=public.rss_pre_request"]
exit 0
```

Production privileges (read before applying):

```
[{"r":"anon","auth_usage":true,"jwt_exec":true,"mfa_exec":true},{"r":"authenticated",…true…},{"r":"service_role",…true…}]
```

Live REST API, before and after (anon key, harmless calls):

```
before: rpc/pilot_code_status: HTTP/2 200 | x-rss-guard:   | body: {"valid": false} · table read: HTTP/2 200
npm run db:apply → applying 0315_mfa_pre_request.sql … ok · DB now at 0315 · ✅ ALL 33 invariants hold
after:  rpc/pilot_code_status: HTTP/2 200 | x-rss-guard: 1 | body: {"valid": false} · table read: HTTP/2 200 | x-rss-guard: 1
elostate.com /api/health 200 (supabase reachable) · /login 200 · /security 200
```

## Findings

### F1 - the first version would have refused the service role in a database without auth-schema grants
class: a hook that runs for every request depending on a privilege only some roles were known to have.
sweep: the PGlite replay (service role: "permission denied for schema auth"); production grants read (all true).
severity: high (caught before applying)

### F2 - a held session's refusal can't be exercised end to end from here
class: proving a refusal needs an aal1 token of an account with codes on, which needs TOTP enabled (MFA R1).
sweep: `grep -n "R1-totp-config" docs/tbc/2026-11-23-mfa/closure.md` → still open.
severity: medium
