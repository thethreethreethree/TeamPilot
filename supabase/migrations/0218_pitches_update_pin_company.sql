-- 0218_pitches_update_pin_company.sql
--
-- Fix (rls:audit / INV15, 2026-08-18): the "pitches - update own" policy from 0215 pinned only
-- rep_id in its WITH CHECK, so a rep could UPDATE their own pitch and move it into ANOTHER tenant
-- (company_id was never re-asserted on the new row). Re-create it pinning company_id too: a rep may
-- edit only their own pitch, and only within their own company. Forward-only; 0215 untouched.
drop policy if exists "pitches - update own" on pitches;
create policy "pitches - update own" on pitches for update
  using (rep_id = auth.uid())
  with check (rep_id = auth.uid() and company_id = auth_company_id());
