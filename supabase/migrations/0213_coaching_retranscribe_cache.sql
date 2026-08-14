-- 0213_coaching_retranscribe_cache.sql
--
-- Cache the diarization result of /retranscribe so a reload / 2nd tab / on-mount auto-fire does NOT re-run a
-- full batch STT diarization for the SAME recording — a duplicate STT charge every time (2026-08-14 spend
-- hole-hunt, finding ④). The audio for a session is fixed, so its diarization is effectively fixed; the first
-- retranscribe stores its result here and every repeat returns the cached result with no STT re-charge.
--
-- This is a CACHE, not an append-only asset (the append-only discipline does not apply): a disposable
-- optimization keyed on the
-- session, REPLACED on a forced re-diarize and INVALIDATED when a new recording is uploaded for the session. So
-- it deliberately carries NO append-only rules.
--
-- Access: service-role ONLY. Every read/write is via the /retranscribe route's admin client, which already
-- authorizes owner-or-manager (INV19) and tenant-scopes by company_id in code — a member must never read or
-- mutate the cache directly. RLS is ENABLED with NO policies (the care_visitor_presence pattern); the four
-- operations are allowlisted in scripts/rls-audit.mjs with this reasoning.
--
-- Idempotent (A12): create-if-not-exists. Safe to run twice.

create table if not exists coaching_retranscribe_cache (
  -- One cache row per session (the session has one recording). PK = session_id so a refresh UPSERTs.
  session_id       uuid primary key references coaching_sessions(id) on delete cascade,
  company_id       uuid not null references companies(id) on delete cascade,
  -- The audio pointer this diarization was produced from. The route compares it to the session's CURRENT
  -- audio_asset_url on read: a mismatch means a NEW recording was uploaded, so the cache is stale and is
  -- ignored (a fresh diarize re-caches). This makes the cache SELF-INVALIDATING — no invalidation hook needed
  -- at every audio-write site.
  audio_asset_url  text not null,
  -- The route's JSON response: { segments: [{speakerId,text,seq}], speakers: [{speakerId,sample}] }.
  result           jsonb not null,
  created_at       timestamptz not null default now()
);

create index if not exists coaching_retranscribe_cache_company_idx
  on coaching_retranscribe_cache (company_id);

alter table coaching_retranscribe_cache enable row level security;

-- No policies BY DESIGN — service-role-only (see header). The 4 ops are allowlisted in scripts/rls-audit.mjs.
