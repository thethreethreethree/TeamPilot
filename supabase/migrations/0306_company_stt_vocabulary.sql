-- 0306 — a company's transcription vocabulary (Gong F8.9, 2026-11-22).
--
-- Product, plan and competitor names that speech-to-text gets wrong break search and trackers. ElevenLabs biases a
-- transcript toward a list of `keyterms` (verified live 2026-11-22: batch scribe_v1/v2 accept repeated form fields, a
-- JSON string is refused; the realtime socket accepts repeated `keyterms=` query params and echoes them in
-- session_started). It costs a 20% transcription surcharge, so it is OPT-IN: an empty list (or no row) = off = no
-- surcharge. A change is a new row; the current list is the latest (§3.1), like company_recording_settings (0284).
-- No client writes: the settings route writes after checking the caller is a company admin. Re-runnable.

create table if not exists public.company_stt_vocabulary (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  -- ≤100 terms keeps every request under the provider's 20-second minimum charge, which applies above 100.
  terms text[] not null default '{}' check (cardinality(terms) <= 100),
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists company_stt_vocabulary_company_idx on public.company_stt_vocabulary (company_id, id desc);
alter table public.company_stt_vocabulary enable row level security;
drop policy if exists rss_vocab_select on public.company_stt_vocabulary;
create policy rss_vocab_select on public.company_stt_vocabulary for select to authenticated
  using (company_id = auth_company_id());
create or replace rule company_stt_vocabulary_no_update as on update to public.company_stt_vocabulary do instead nothing;
create or replace rule company_stt_vocabulary_no_delete as on delete to public.company_stt_vocabulary do instead nothing;
