-- 0314 — "keep transcripts only" (2026-11-23; gong.io capture M36 "Transcript-only mode (no recording kept)", graded
-- PARTIAL: "Audio is removed after 90 days (D14) or by a manager; no 'never keep audio' setting").
--
-- A company admin can choose that call audio is NOT kept: the nightly clean-up removes a call's audio once the call has a
-- transcript and is a day old (the day lets the "which voice is you?" step and a re-transcription run). Audio has to
-- exist briefly — it is what gets transcribed — so the honest promise is "removed after transcription", not "never
-- recorded". Saved recordings stay exempt, as for every rule.
--
-- A setting is still a new row (§3.1); transcript_only rows carry no count. The rule lives in retention.ts (ruleFor /
-- outsideRetention), read by both the purge cron and the settings route. Re-runnable.

alter table public.company_recording_settings add column if not exists transcript_only boolean not null default false;
alter table public.company_recording_settings drop constraint if exists company_recording_settings_transcript_only_no_count;
alter table public.company_recording_settings add constraint company_recording_settings_transcript_only_no_count
  check (not transcript_only or keep_last_per_rep is null);
comment on column public.company_recording_settings.transcript_only is
  'True: keep transcripts only — the purge removes a call''s audio once it has a transcript and is a day old (0314).';
