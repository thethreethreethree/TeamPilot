# Closure

## What shipped
The Members page "Add agent" is streamlined: add a teammate by email — an existing Elostate/Sales Coach account
joins immediately; a brand-new person is created with a picked, titled TEAM PASSWORD and is forced to set their
own password on first login. A "Team passwords" control (create/view/copy/change/delete, multiple, titled) sits
beside Add agent. All routes admin-gated + service-role + company-pinned; team_passwords is RLS-deny-all;
must_change_password is guarded against self-clear.

## Residual (A36 — ranked)
```json
{ "id": "R1", "item": "Multi-company reassignment: adding an EXISTING account that already belongs to another team reassigns their profiles.company_id (single-membership model).", "why_skipped": "The founder explicitly deferred this complication ('this will be done in the future'). Direct add matches the requested 'automatic' behaviour for the common case (account with no/own company).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-21T05:55:00Z", "outcome": "OPENED — documented in-code; a future build should offer join-without-leaving or a confirm when the target already has a different company." }
```
```json
{ "id": "R2", "item": "team_passwords.secret is stored recoverably (admin-viewable, to distribute).", "why_skipped": "Inherent to the feature — a shared join credential the admin must be able to view and hand out. The boundary is RLS-deny-all + service-role + admin-gate + company-pin.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-21T05:55:00Z", "outcome": "OPENED — encryption-at-rest (pgcrypto/app-key) is the hardening follow-up; noted in the migration." }
```
```json
{ "id": "R3", "item": "Live end-to-end (real createUser + forced-change redirect on a real browser session) not run; needs migration 0235 applied.", "why_skipped": "No live DB/session in the build sandbox; the deterministic layers pass npm run check (exit 0, 3446 passing).", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": "Migration apply (npm run db:apply) is a blocking setup step (§1.5.3); flagged to the founder. The forced-change gate is migration-coupling-safe (inactive until applied), and the team_passwords routes need the table." }
```

## The un-named reliance (A20/A35)
- I relied on `handle_new_user` creating the profile shell synchronously on `auth.admin.createUser`, then upsert
  pinning the privileged columns via service-role. If that trigger were ever async/absent, the upsert (onConflict
  id) still inserts the row — so the membership lands either way; the risk is only a benign double-path.
- I relied on the isolated must_change_password guard NOT conflicting with the 0090/0091 guard — it is a separate
  trigger on the same table, and Postgres runs both BEFORE UPDATE triggers; neither touches the other's columns.

## Constitutional bearing
Understanding-first (§0): mapped the real auth model before building. Security ground-up (§1.7): every surface
gated + pinned + service-role, deny-all on the secret. Single-source (§2.2): one password validator. Honesty
(§3.4): no orphan half-accounts, honest 404/409, deferred complication documented not hidden.
