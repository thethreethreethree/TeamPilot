-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0304 — Macro Mode ownership rules (independent review of 0303, 2026-11-22)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Macro Mode is the VIEWER's switch, so a manager opening a rep's call sees the rep's Highlights and Next Meeting.
-- 0303 let that manager act as if the call were theirs:
--   1. "Add to pipeline" linked the rep's call into the MANAGER's pipeline (rep_id = the caller). remote_prospect_calls
--      is one-row-per-call and append-only, so the rep could never link it, kept seeing "Add", and every click left
--      an undeletable nameless prospect behind.
--   2. A manager's checklist review counted as THE review: the rep never got the ask-first step (§3.3), and a second
--      review (or a retry) created every task twice.
--   3. A prospect and its first facts were separate inserts: a failure in between left a nameless prospect forever.
--
-- The rules, structurally (not trusted to the screens):
--   · a call joins a prospect only when the call's rep IS the prospect's rep;
--   · a checklist is reviewed by the call's own rep, once per brief;
--   · a prospect, its first facts and its first call are written in ONE transaction (rss_create_prospect, invoker:
--     every insert still passes 0303's policies as the caller).
-- Re-runnable (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- 1. A call joins only its own rep's prospect.
drop policy if exists rmm_pcalls_insert on public.remote_prospect_calls;
create policy rmm_pcalls_insert on public.remote_prospect_calls for insert to authenticated
  with check (company_id = auth_company_id() and linked_by = auth.uid()
              and exists (select 1 from remote_prospects p
                            join coaching_sessions s on s.id = remote_prospect_calls.session_id
                           where p.id = remote_prospect_calls.prospect_id
                             and s.company_id = auth_company_id()
                             and s.agent_id = p.rep_id));

-- 2. The call's own rep reviews its checklist, once.
drop policy if exists rmm_reviews_insert on public.remote_checklist_reviews;
create policy rmm_reviews_insert on public.remote_checklist_reviews for insert to authenticated
  with check (company_id = auth_company_id() and reviewed_by = auth.uid()
              and exists (select 1 from remote_call_briefs b
                           where b.id = remote_checklist_reviews.brief_id and b.rep_id = auth.uid()));
create unique index if not exists remote_checklist_reviews_once on public.remote_checklist_reviews (brief_id);

-- 3. One transaction for a new prospect. SECURITY INVOKER: the caller's own RLS applies to every insert.
create or replace function public.rss_create_prospect(
  p_name text,
  p_organization text default null,
  p_amount numeric default null,
  p_stage_label text default null,
  p_next_call date default null,
  p_session uuid default null
) returns uuid
  language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null or v_company is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'a prospect needs a name' using errcode = '22023'; end if;
  insert into remote_prospects (company_id, rep_id, created_by) values (v_company, v_me, v_me) returning id into v_id;
  insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    values (v_id, v_company, 'name', jsonb_build_object('text', left(trim(p_name), 120)), v_me);
  if p_organization is not null and length(trim(p_organization)) > 0 then
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
      values (v_id, v_company, 'organization', jsonb_build_object('text', left(trim(p_organization), 120)), v_me);
  end if;
  insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    values (v_id, v_company, 'stage',
            case when p_stage_label is not null and length(trim(p_stage_label)) > 0
                 then jsonb_build_object('status', 'open', 'label', left(trim(p_stage_label), 60))
                 else jsonb_build_object('status', 'open') end, v_me);
  if p_amount is not null then
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
      values (v_id, v_company, 'amount', jsonb_build_object('amount', p_amount), v_me);
  end if;
  if p_next_call is not null then
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
      values (v_id, v_company, 'next_call', jsonb_build_object('date', p_next_call::text), v_me);
  end if;
  if p_session is not null then
    -- Refused (and the whole prospect rolled back) unless the call is the caller's own and not linked yet.
    insert into remote_prospect_calls (prospect_id, session_id, company_id, linked_by) values (v_id, p_session, v_company, v_me);
  end if;
  return v_id;
end $$;
revoke all on function public.rss_create_prospect(text, text, numeric, text, date, uuid) from public, anon;
grant execute on function public.rss_create_prospect(text, text, numeric, text, date, uuid) to authenticated;
