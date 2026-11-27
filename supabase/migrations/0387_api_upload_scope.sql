-- 0387 — an "upload" scope for company API keys (2026-11-27; Engage plan E6, decision E7 as amended and E10; Gong F6.9;
-- founder pickers 2026-11-27 "Add an 'upload calls' key scope", "Rep picks it in the app"). Re-runnable.
--
-- 0378's keys were read-only ('read', 'mcp'). A key may now also hold 'upload': POST /api/v1/calls creates a phone or
-- video call for one of the company's reps from an audio file, stores and transcribes it like an app upload, and leaves
-- it waiting for that rep to say which voice is theirs (and confirm the customer knew it was recorded) before it is
-- scored. Keys are still made only by company admins (the api-keys route), stored only as a hash.

alter table public.api_keys drop constraint if exists api_keys_scopes_check;
alter table public.api_keys add constraint api_keys_scopes_check
  check (scopes <@ array['read', 'mcp', 'upload']::text[] and cardinality(scopes) >= 1);

-- The rep is told a call was added for them and waits for their answer (0379's closed set plus 'call_needs_voice').
alter table manager_notifications drop constraint if exists manager_notifications_type_check;
alter table manager_notifications
  add constraint manager_notifications_type_check
  check (type in (
    'strong_session', 'deal_closed', 'pitch_score_corrected', 'recording_comment', 'recording_share_requested',
    'pattern_coached', 'pattern_clip_disputed', 'feedback_requested', 'training_attempted', 'call_ready',
    'comment_mention', 'score_disputed', 'dispute_answered', 'call_scored', 'call_access_granted',
    'agent_ran', 'call_needs_voice'
  ));
