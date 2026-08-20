# Build — streamlined Add-agent + team passwords

## Features (inventory + A31 reachability — both directions of every seam)

### Add a team member by email (existing / new)
- files: src/app/api/team/add-member/route.ts, src/components/team/AddAgentDialog.tsx, src/app/dashboard/sales-coach/team/page.tsx
- write-path: EXISTS — an admin opens "Add agent", enters an email, picks Existing or New (+ a team password for
  New) and a Sales Coach role; the dialog POSTs /api/team/add-member (admin-gated, service-role, company-pinned).
  Existing → attach the account to this company; New → `auth.admin.createUser({email, password: teamSecret,
  email_confirm:true})` + profile provision (role, sales_coach_role, must_change_password:true). human_can_set: true.
- read-path: EXISTS — the added person appears in the Members list (existing → immediately; new → after they
  sign in); a new user is bounced to /set-password on first sign-in. human_can_see: true.

### Team passwords (create / view / copy / delete, titled, multiple)
- files: src/app/api/team/passwords/route.ts, src/components/team/TeamPasswordsDialog.tsx, src/app/dashboard/sales-coach/team/page.tsx
- write-path: EXISTS — "Team passwords" (beside Add agent) opens a dialog to create a titled, policy-validated
  password (POST), and delete one (soft-delete DELETE). Change is PATCH. All admin-gated, service-role, company-pinned. human_can_set: true.
- read-path: EXISTS — the dialog lists each password with its title + secret (GET, admin-viewable to distribute)
  and a Copy button; the New-user add flow reads the picked one server-side as the initial credential. human_can_see: true.

### Forced first-login password change
- files: src/app/api/team/set-password/route.ts, src/app/set-password/page.tsx, src/app/dashboard/layout.tsx, supabase/migrations/0235_add_agent_team_passwords.sql
- write-path: EXISTS — a new user (must_change_password) is redirected to /set-password, sets their own password
  (live policy checklist), which POSTs /api/team/set-password: service-role `updateUserById` + clears the flag in
  one op. human_can_set: true.
- read-path: EXISTS — the dashboard layout reads must_change_password (best-effort, migration-coupling-safe) and
  redirects while set; once cleared, the user reaches the dashboard. human_can_see: true.

## Files
- `0235_add_agent_team_passwords.sql` (NEW) — profiles.must_change_password + guard trigger; team_passwords table + RLS deny-all.
- `src/lib/auth/passwordPolicy.ts` (NEW) — single strong-password validator (both surfaces, §2.2).
- `src/app/api/team/passwords/route.ts` (NEW) — CRUD, admin-gated/service-role/company-pinned.
- `src/app/api/team/add-member/route.ts` (NEW) — existing/new add, discriminated union.
- `src/app/api/team/set-password/route.ts` (NEW) — set own password + clear flag.
- `src/app/set-password/page.tsx` (NEW) — forced first-login change UI.
- `src/components/team/AddAgentDialog.tsx`, `TeamPasswordsDialog.tsx` (NEW) — the two dialogs.
- `src/app/dashboard/layout.tsx` — forced-change redirect gate.
- `src/app/dashboard/sales-coach/team/page.tsx` — buttons + wiring + copy.
- `scripts/rls-audit.mjs` — team_passwords deny-all allowlist (per-op reasons).

## Decisions
- Admin creates the account with the team password as the initial credential (founder pick); forced change after.
- team_passwords.secret stored recoverably because it MUST be admin-viewable to distribute — boundary is
  RLS-deny-all + service-role + admin-gate + company-pin (encryption-at-rest = documented follow-up).
- must_change_password guarded by an ISOLATED trigger (not folded into the critical 0090/0091 guard).
- One password validator shared by the team-password and first-login surfaces (no drift).
