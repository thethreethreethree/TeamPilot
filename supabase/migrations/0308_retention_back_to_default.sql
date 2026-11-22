-- 0308 — a company can go back to the standard recording retention (D14, 2026-11-23).
--
-- D14 was decided 2026-11-23: with no setting, call audio is kept 90 days (src/lib/coach/remote/retention.ts). A setting
-- is an append-only row (0284, §3.1) holding "keep each rep's last N", and the latest row wins — so once a company had
-- chosen a number there was no row that could mean "back to the standard". A NULL count is that row: the latest row
-- with no count = the default. The existing check (between 1 and 1000) is satisfied by NULL, and every earlier row keeps
-- its meaning. No policy changes; writes stay route-only. Re-runnable.

alter table public.company_recording_settings alter column keep_last_per_rep drop not null;

comment on column public.company_recording_settings.keep_last_per_rep is
  'Keep each rep''s last N recordings'' audio. NULL (latest row) = the standard default: 90 days (D14, 2026-11-23).';
