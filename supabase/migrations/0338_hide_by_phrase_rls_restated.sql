-- 0338 — the 0337 hide-by-phrase tables' row security, restated as plain statements (F33.8).
-- 0337 set these inside a DO loop (format/execute). Production has them (verified by the signed-in replay and
-- verify:live), but scripts/rls-audit.mjs and the invariant audit's append-only replay read migrations as text and
-- can't see dynamic SQL — so a record that only holds the loop reads as "no RLS". Every statement here is idempotent
-- and identical to what the loop ran; nothing changes on a database that already applied 0337.

alter table public.hide_phrases enable row level security;
drop policy if exists rss_hide_phrases_select on public.hide_phrases;
create policy rss_hide_phrases_select on public.hide_phrases for select to authenticated using (company_id = auth_company_id());
drop policy if exists mfa_required on public.hide_phrases;
create policy mfa_required on public.hide_phrases as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule hide_phrases_no_update as on update to public.hide_phrases do instead nothing;
create or replace rule hide_phrases_no_delete as on delete to public.hide_phrases do instead nothing;

alter table public.hide_phrase_retirements enable row level security;
drop policy if exists rss_hide_phrase_retirements_select on public.hide_phrase_retirements;
create policy rss_hide_phrase_retirements_select on public.hide_phrase_retirements for select to authenticated using (company_id = auth_company_id());
drop policy if exists mfa_required on public.hide_phrase_retirements;
create policy mfa_required on public.hide_phrase_retirements as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule hide_phrase_retirements_no_update as on update to public.hide_phrase_retirements do instead nothing;
create or replace rule hide_phrase_retirements_no_delete as on delete to public.hide_phrase_retirements do instead nothing;

alter table public.call_hides enable row level security;
drop policy if exists rss_call_hides_select on public.call_hides;
create policy rss_call_hides_select on public.call_hides for select to authenticated using (company_id = auth_company_id());
drop policy if exists mfa_required on public.call_hides;
create policy mfa_required on public.call_hides as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule call_hides_no_update as on update to public.call_hides do instead nothing;
create or replace rule call_hides_no_delete as on delete to public.call_hides do instead nothing;

alter table public.call_unhides enable row level security;
drop policy if exists rss_call_unhides_select on public.call_unhides;
create policy rss_call_unhides_select on public.call_unhides for select to authenticated using (company_id = auth_company_id());
drop policy if exists mfa_required on public.call_unhides;
create policy mfa_required on public.call_unhides as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule call_unhides_no_update as on update to public.call_unhides do instead nothing;
create or replace rule call_unhides_no_delete as on delete to public.call_unhides do instead nothing;
