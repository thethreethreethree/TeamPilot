-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0293 — recording comments gain @mentions and visibility (RSS Phase 2 follow-up; Gong F9.8; UI spec item 8)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- The UI spec: "Comments (existing) + @ picker + visibility selector (Everyone / Named people / Only me)".
--
--   recording_comments.visibility — 'everyone' (today's behaviour, the default for every existing comment),
--     'named' (the author and the people @mentioned), 'only_me' (the author). Set at insert, like sent_to_rep.
--   recording_comment_mentions — who a comment @mentions. Append-only. A mention NOTIFIES (manager_notifications
--     'comment_mention') and, for a 'named' comment, is who may read it.
--
-- VISIBILITY NARROWS, NEVER WIDENS. The read rule is 0273's (a manager over the rep under the tree; the rep once
-- sent), AND the visibility term. Mentioning someone who cannot see the call does not show them the comment; the
-- comment route refuses such a mention with a sentence instead of letting it fail quietly. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

alter table public.recording_comments
  add column if not exists visibility text not null default 'everyone';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recording_comments_visibility_check') then
    alter table public.recording_comments
      add constraint recording_comments_visibility_check check (visibility in ('everyone', 'named', 'only_me'));
  end if;
end $$;

create table if not exists public.recording_comment_mentions (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  comment_id uuid not null references public.recording_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint recording_comment_mentions_once unique (comment_id, user_id)
);
create index if not exists recording_comment_mentions_user_idx on public.recording_comment_mentions (user_id);
alter table public.recording_comment_mentions enable row level security;
create or replace rule recording_comment_mentions_no_update as on update to public.recording_comment_mentions do instead nothing;
create or replace rule recording_comment_mentions_no_delete as on delete to public.recording_comment_mentions do instead nothing;

-- Whether the CALLER is mentioned on a comment. Definer, so the comments policy can ask without the mentions policy
-- asking the comments policy back (a policy cycle). Reveals one boolean about the caller only.
create or replace function public.rss_comment_mentions_me(p_comment uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from recording_comment_mentions m where m.comment_id = p_comment and m.user_id = auth.uid())
$$;
revoke all on function public.rss_comment_mentions_me(uuid) from public, anon;
grant execute on function public.rss_comment_mentions_me(uuid) to authenticated, service_role;

-- The base rule, ONCE: may this viewer read comments on this pitch at all? Equivalent to 0273's policy (a Sales Coach
-- manager per 0290 whose reporting tree allows the rep — or company-wide before the tree is on — or the rep when the
-- comment was sent). The policy below calls it with auth.uid(); the comment route calls it for each person @mentioned,
-- so "can be mentioned" and "can read it" are one rule and cannot drift (§2.2).
create or replace function public.rss_comment_base_visible(viewer uuid, p_pitch uuid, p_sent boolean) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from pitch_scores p
    join profiles v on v.id = viewer
    where p.id = p_pitch
      and v.company_id = p.company_id
      and v.status <> 'removed'
      and (
        (p.rep_id = viewer and p_sent)
        or (
          (v.role = any (admin_roles()) or v.sales_coach_role = 'admin')
          and (not rss_tree_active(p.company_id) or rss_can_view_rep(viewer, p.rep_id))
        )
      )
  )
$$;
revoke all on function public.rss_comment_base_visible(uuid, uuid, boolean) from public, anon;
grant execute on function public.rss_comment_base_visible(uuid, uuid, boolean) to authenticated, service_role;

drop policy if exists "recording_comments - select" on recording_comments;
create policy "recording_comments - select" on recording_comments
  for select using (
    company_id = auth_company_id()
    and rss_comment_base_visible(auth.uid(), pitch_id, sent_to_rep)
    and (
      visibility = 'everyone'
      or author_id = auth.uid()
      or (visibility = 'named' and rss_comment_mentions_me(id))
    )
  );

-- A mention is readable by the person mentioned, and by whoever can read the comment it belongs to.
drop policy if exists rss_rcm_select on public.recording_comment_mentions;
create policy rss_rcm_select on public.recording_comment_mentions for select to authenticated
  using (company_id = auth_company_id()
         and (user_id = auth.uid() or exists (select 1 from recording_comments c where c.id = recording_comment_mentions.comment_id)));
