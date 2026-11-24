-- 0333 — a manager can edit or remove their own call comment, on the record (2026-11-25; Gong ledger F9.8: "edit/delete").
--
-- recording_comments rows are never updated (0259: "a correction is a new comment"). An edit or a removal is a new
-- REVISION row here; readers show a comment's latest revision ("edited") and leave out a removed one. The original
-- text stays in recording_comments, so what the rep read is never lost (§3.1).
--
-- Only the comment's author writes a revision — through the comment route with the service role (no insert policy);
-- the route checks the author and the company. Reading follows the parent comment: a revision is visible exactly when
-- its comment is (the subquery runs under recording_comments' own RLS, 0293).
--
-- Legal erasure: comments are outside it by the stated rule in 0285 ("anything a person retyped elsewhere — a
-- comment…"); revisions are comments' text, so the same rule applies. No CASCADE from recording_comments: nothing
-- deletes comments (they are append-only in practice), and a revision must not vanish silently.
-- Re-runnable.

create table if not exists public.recording_comment_revisions (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  comment_id uuid not null references public.recording_comments(id),
  author_id uuid not null references public.profiles(id),
  body text,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint recording_comment_revisions_body check (removed or (body is not null and length(btrim(body)) > 0 and length(body) <= 2000)),
  constraint recording_comment_revisions_removed_no_body check (not removed or body is null)
);
create index if not exists recording_comment_revisions_idx on public.recording_comment_revisions (comment_id, id desc);

alter table public.recording_comment_revisions enable row level security;
drop policy if exists rss_comment_revisions_select on public.recording_comment_revisions;
create policy rss_comment_revisions_select on public.recording_comment_revisions for select to authenticated
  using (
    company_id = auth_company_id()
    and exists (select 1 from public.recording_comments c where c.id = recording_comment_revisions.comment_id)
  );
drop policy if exists mfa_required on public.recording_comment_revisions;
create policy mfa_required on public.recording_comment_revisions as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule recording_comment_revisions_no_update as on update to public.recording_comment_revisions do instead nothing;
create or replace rule recording_comment_revisions_no_delete as on delete to public.recording_comment_revisions do instead nothing;
