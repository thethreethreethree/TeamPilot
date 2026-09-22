-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0266 — the column that decides who is an admin stops accepting any string
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- FOUNDER RULING 2026-09-22: a CHECK allowing what is already there.
--
-- THE DEFECT. `profiles.role` has no CHECK constraint. The only role-ish constraint on the table
-- is `profiles_sales_coach_role_check`; a search for one naming `role` returns zero. And
-- `admin_roles()` (0265) compares against this column, so:
--
--     update profiles set role = 'CEo' where id = …;
--
-- succeeds, and that person is not an admin. No error, at any layer. The direction of failure is
-- the safe one — a typo REMOVES authority rather than granting it — and it is completely silent.
-- The person sees a product without its admin surfaces and cannot tell that apart from a
-- permissions decision somebody made about them.
--
-- Found by finishing a sweep rather than by looking for it: the drift gate built an hour earlier
-- asked which TypeScript constants mirror a SQL set, and this column ran the sweep out of
-- subjects. It has no set.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- THE VALID SET, FROM THE RECORD RATHER THAN FROM WHAT A ROLE COLUMN OUGHT TO HOLD
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Three writers, all read before this was written:
--
--   /api/team/set-role        the 8 assignable roles, validated by isAssignableOrgRole
--   invite acceptance         0008:154 inserts the invitation's role, itself constrained to the
--                             9 by team_invitations_role_check (0239)
--   onboarding RPC            0046 / 0047, hard-coded role = 'admin'
--
-- So the reachable set is the 9 invitable roles plus 'admin'.
--
-- And production, counted immediately before writing this (24 profiles, counts only):
--
--     "admin" 10 · "Member" 9 · null 3 · "Manager" 1 · "member" 1
--
-- 'member' — lowercase — is the one that does not fit, and ITS ORIGIN IS UNKNOWN. The first
-- explanation that came to mind was that 0008's CHECK had been lowercase; 0008 line 46 reads
--
--     check (role in ('CEO','COO','Lead','Member'))
--
-- mixed case. The earlier reading that said otherwise came from the enum audit's parser, which
-- lowercases the whole file — a transformation mistaken for the migration. A column with no
-- constraint cannot tell you how a value got into it, and that is the defect rather than a
-- footnote to it.
--
-- NULL is permitted because 3 live rows are null and nothing treats a missing role as invalid:
-- `isAdminRole(null)` is false and `orgRoleRank(null)` sorts last, both deliberately.
--
-- NOT permitted: any other spelling. No row holds one. If one appears, a rejected write is how we
-- find out, which is the entire point of the constraint.
--
-- Re-runnable (A12): the constraint is dropped if present before being added.

alter table profiles drop constraint if exists profiles_role_check;

alter table profiles
  add constraint profiles_role_check
  -- `role in (...)` FIRST, then the null branch. Semantically identical either way; NOT identical
  -- to the tooling. `enum:audit` matches `check\s*\(\s*(col)\s+in\s*\(` — the column and its
  -- list adjacent to the opening paren — so `check (role is null or role in (...))` is invisible
  -- to it, and this column would silently never be available as a mirror subject. 0239 made the
  -- same ordering choice for the same kind of reason and wrote it down; this is that note, one
  -- migration later, from the other direction.
  check (
    role in (
      -- the 9 invitable roles (team_invitations_role_check, 0239)
      'CEO', 'CFO', 'COO', 'VP', 'Director', 'Manager', 'Supervisor', 'Lead', 'Member',
      -- the onboarding founder role (0046/0047) — in ADMIN_ROLES, never invitable
      'admin',
      -- DEBT, NOT A DECISION. One live row holds this lowercase spelling and its origin cannot be
      -- traced, because until this migration there was nothing to stop it being written. Allowed
      -- so the constraint does not break existing data; listed separately so it is visible as the
      -- odd one out rather than blending into the set. Removing it means updating that row, which
      -- is a write to a real person's record and is the founder's call, not a tidy-up.
      'member'
    )
    or role is null
  );

comment on constraint profiles_role_check on profiles is
  'The roles storable in profiles.role. The 9 invitable (0239) + the onboarding admin + one legacy lowercase member with one live row. See 0266 for why each is here. Adding a role to ORG_ROLE_OPTIONS in roles.ts means adding it here too — there is no gate comparing them, because there is no single TypeScript constant that means "storable".';
