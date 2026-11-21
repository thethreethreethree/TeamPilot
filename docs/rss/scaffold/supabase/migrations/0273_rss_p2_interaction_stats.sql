-- 0273_rss_p2_interaction_stats.sql
-- ELOSTATE Remote Sales System - Phase 2: interaction stats per session (F9.9, F10.1-F10.6).
-- Computed by src/lib/coach/remote/stats.ts from the timed transcript; one row per session,
-- recomputed when a new transcript version lands (0269 transcript_versions).

create table public.session_interaction_stats (
  session_id uuid primary key references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  transcript_version integer not null,
  talk_ratio_time numeric check (talk_ratio_time between 0 and 1),     -- null: no known speech
  longest_rep_monologue_ms integer not null check (longest_rep_monologue_ms >= 0),
  longest_customer_story_ms integer not null check (longest_customer_story_ms >= 0),
  interactivity numeric check (interactivity between 0 and 10),        -- null: only one side spoke
  patience_ms integer check (patience_ms >= 0),                        -- null: rep never answered the customer
  rep_questions_per_hour numeric check (rep_questions_per_hour >= 0),
  computed_at timestamptz not null default now()
);
comment on table public.session_interaction_stats is
  'RSS: nulls mean "not measurable on this session" (see column comments), never "not filled in yet".';
alter table public.session_interaction_stats enable row level security;
create policy rss_stats_select on public.session_interaction_stats for select to authenticated
  using (rss_can_view_rep(auth.uid(), rep_id));
-- Deliberately NO write policies: computed by the pipeline (service role).
