-- 0079: capture the coach's READ on delivered cues (audit F1, 2026-07-01).
--
-- WHY: the live coach fires cues on a measured read — the conversation phase,
-- the trigger, and (build 3) the stress signal — but until now only the cue
-- text + mode were stored. §4/§1.1 — a measurement you don't persist can't be
-- validated. Recording WHY each cue fired lets build 4 correlate cues to
-- OUTCOMES (did stress/objection cues change the result?).
--
-- §3.1 — append-only: nullable columns on the existing coaching_cues table;
-- the do-instead-nothing update/delete rules already cover them. Existing
-- rows keep null (honest: we didn't record it then).

alter table coaching_cues
  add column if not exists trigger text,   -- objection | filler_spike | pace_spike | stall | buying_signal | …
  add column if not exists signal  jsonb;  -- the measured stress signal (build 3), when present
