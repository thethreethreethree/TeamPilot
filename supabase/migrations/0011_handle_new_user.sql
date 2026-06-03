-- 0011 — handle_new_user trigger
--
-- Why: signup writes a row to `auth.users`, but `public.profiles` was
-- empty until we manually seeded it. This trigger auto-creates a
-- placeholder profile when a new auth user is created, so the
-- post-signup dashboard load never hits the "no profile" branch.
--
-- Discipline:
--  - The trigger does NOT auto-assign a company. Company-on-signup is
--    a business decision, not a data-layer assumption. We leave
--    company_id NULL and let the onboarding flow (or an explicit
--    invite-acceptance) populate it. This matches §3.4: the System
--    refuses to invent membership the user did not opt into.
--  - We seed full_name from raw_user_meta_data.full_name if provided,
--    else from the email's local part. role defaults to NULL until the
--    user joins a company.
--  - SECURITY DEFINER lets the trigger insert into a table the
--    signing-up user has no direct write privilege on. The function
--    is owned by the postgres role.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company_id, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    null,
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Seeds a profiles row on signup. Leaves company_id NULL until the user joins or creates one explicitly (§3.4 — never invent membership).';
