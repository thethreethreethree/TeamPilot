-- 0354 — known mis-hearings in the transcription vocabulary (2026-11-26; Gong ledger F8.9). Idempotent (A12).
--
-- For a term, what speech-to-text writes instead ("Spectrum" heard as "spec trum"). Stored on the same append-only row
-- as the terms (0306: a change is a new row; the latest is current). Every transcript line is stored with these
-- replaced by the term (vocabulary.ts applyCorrections, at the two writers in salesCoach.ts). Shape:
-- [{"term": "Spectrum", "heard": ["spec trum", "spektrum"]}].

alter table public.company_stt_vocabulary add column if not exists corrections jsonb not null default '[]'::jsonb;
alter table public.company_stt_vocabulary drop constraint if exists company_stt_vocabulary_corrections_array;
alter table public.company_stt_vocabulary add constraint company_stt_vocabulary_corrections_array check (jsonb_typeof(corrections) = 'array');
