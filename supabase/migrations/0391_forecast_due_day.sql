-- 0391 — the forecast due day and its reminder (2026-11-27; revenue plan phase 8; Gong F22.4). Re-runnable.
--
--   · companies.forecast_due_weekday — the weekday forecasts are due (0 Sunday … 6 Saturday; default 1, Monday). Only
--     company admins (admin_roles()) may change it, the same shape as 0226's schedule settings (a separate trigger, its own
--     concern). Service-role contexts pass.
--   · manager_notifications type 'forecast_due' — the bell reminder.
--   · forecast_reminders — the nightly job's claim, one row per person per due date (primary key), inserted before the
--     reminder is sent so overlapping runs never send it twice. Written and read by the service role only (no
--     policies). Append-only. No customer words (ids and a date).

alter table public.companies add column if not exists forecast_due_weekday smallint not null default 1;
alter table public.companies drop constraint if exists companies_forecast_due_weekday_check;
alter table public.companies add constraint companies_forecast_due_weekday_check check (forecast_due_weekday between 0 and 6);

create or replace function public.guard_company_forecast_settings() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.forecast_due_weekday is not distinct from old.forecast_due_weekday then
    return new;
  end if;
  if exists (select 1 from profiles p where p.id = auth.uid() and p.company_id = old.id and p.role = any (admin_roles())) then
    return new;
  end if;
  raise exception 'companies.forecast_due_weekday is a company setting — only a company admin may change it';
end $$;
drop trigger if exists companies_guard_forecast_settings on public.companies;
create trigger companies_guard_forecast_settings before update on public.companies
  for each row execute function public.guard_company_forecast_settings();

alter table manager_notifications drop constraint if exists manager_notifications_type_check;
alter table manager_notifications
  add constraint manager_notifications_type_check
  check (type in (
    'strong_session', 'deal_closed', 'pitch_score_corrected', 'recording_comment', 'recording_share_requested',
    'pattern_coached', 'pattern_clip_disputed', 'feedback_requested', 'training_attempted', 'call_ready',
    'comment_mention', 'score_disputed', 'dispute_answered', 'call_scored', 'call_access_granted',
    'agent_ran', 'call_needs_voice', 'forecast_due'
  ));

create table if not exists public.forecast_reminders (
  company_id uuid not null references public.companies(id),
  user_id uuid not null references public.profiles(id),
  due_day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, due_day)
);
create or replace rule forecast_reminders_no_update as on update to public.forecast_reminders do instead nothing;
create or replace rule forecast_reminders_no_delete as on delete to public.forecast_reminders do instead nothing;
alter table public.forecast_reminders enable row level security;
