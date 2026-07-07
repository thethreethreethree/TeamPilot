-- 0092 — drop the profiles.role 'CEO' default (defense-in-depth)
--
-- Follow-up to 0090/0091 (audit 2026-07-07). profiles.role was declared
-- `role text default 'CEO'` (0001:27) — a legacy default from before
-- handle_new_user existed. It is a footgun: any INSERT that omits role lands an
-- admin role.
--
-- 0091 already neutralises this on the direct authenticated/anon path (the guard
-- rejects a non-null NEW.role, and the 'CEO' default makes it non-null). But the
-- guard EXEMPTS privileged writers — so a future SECURITY DEFINER function that
-- inserts a profile row and forgets to set role would silently get 'CEO'. The
-- root fix is to remove the privileged default entirely.
--
-- Safe: nothing relies on the 'CEO' default. handle_new_user sets role = NULL
-- explicitly (0011); complete_company_onboarding sets 'admin' explicitly (0046);
-- accept_invitation sets the invitation's role explicitly (0008). A profile with
-- no company/role is the correct pre-onboarding state (§3.4 — invent no
-- membership). New default is NULL; the safe empty state becomes the safe default.

alter table profiles alter column role drop default;

comment on column profiles.role is
  'Leadership/role label (CEO/COO/admin/Member/…). No default — set explicitly by handle_new_user (null pre-onboarding), complete_company_onboarding (admin), or accept_invitation (invite role). Never defaulted, so a forgotten INSERT cannot grant CEO. See 0092.';
