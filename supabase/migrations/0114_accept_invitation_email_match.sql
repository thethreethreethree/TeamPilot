-- 0114 — F1 (HIGH, audit 2026-07-10): accept_invitation must verify the accepting
--        user's email matches the invitation's email.
--
-- ⚠️ UNAPPLIED — STAGING RUNTIME TEST REQUIRED. This edits the crown-jewel account-join
-- path. On staging: (1) create an invite for email X, (2) sign in as X, accept — must
-- succeed; (3) sign in as Y (different email), try to accept X's code — must be REJECTED
-- with the friendly message; (4) confirm a normal invite→accept still onboards. Then promote.
--
-- THE FINDING (0008:116-144). accept_invitation looked up the invite by CODE, validated
-- accepted/revoked/expired, then attached WHOEVER was calling (auth.uid()) to the company
-- at the invite's role — with NO comparison of the caller's email to v_invite.email. So
-- anyone holding an invite CODE (forwarded link, leaked URL) could join as any account at
-- the invite's role, incl. CEO/COO → admin. team_invitations.email is immutability-locked
-- (0008:54) and invite/[code]/page.tsx:137 promises "one email means one person" — the
-- design intends the binding; nothing enforced it (A27). Fix: enforce below the label.
--
-- POLICY DECISION EMBEDDED (surface, don't silently pick — audit conflict #1): this uses
-- EXACT, case-insensitive email match. Consequence: a user invited at alice@work.com who
-- signs in as alice@personal.com is BLOCKED. That is the intended tightening. If you want a
-- looser policy (allow mismatch, or an admin override), change the predicate below — this
-- migration deliberately ships the strict default so the hole is closed by default.
--
-- Only the email check is added; every other line is identical to 0008's function.

create or replace function accept_invitation(p_code text, p_full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite   team_invitations;
  v_user_id  uuid;
  v_user_email text;
  v_company_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from team_invitations where code = p_code;
  if v_invite.id is null then
    raise exception 'Invitation not found';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'Invitation already accepted';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'Invitation revoked';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Invitation expired';
  end if;

  -- F1 (0114): the invite is FOR a specific email — enforce it. DEFINER runs as the
  -- function owner, which can read auth.users. Exact, case-insensitive match.
  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null
     or lower(trim(v_user_email)) is distinct from lower(trim(v_invite.email)) then
    raise exception 'This invitation was sent to %. Sign in with that email address to accept it.', v_invite.email;
  end if;

  v_company_id := v_invite.company_id;

  -- Attach the user to the company.
  insert into profiles (id, company_id, full_name, role, status)
    values (v_user_id, v_company_id, p_full_name, v_invite.role, 'active')
    on conflict (id) do update
      set company_id = excluded.company_id,
          role       = excluded.role,
          status     = 'active',
          full_name  = coalesce(profiles.full_name, excluded.full_name);

  -- Stamp the invitation.
  update team_invitations
    set accepted_at = now(),
        accepted_by = v_user_id
    where id = v_invite.id;

  return v_company_id;
end;
$$;
