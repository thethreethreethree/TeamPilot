-- 0026 — Document orphan event kinds as A4-deferred signal_sources rows
--
-- Closes §1.7 audit findings H3, H4, M7 (2026-06-12).
--
-- The audit found that coach.*, decision.*, and several task.* event
-- kinds fire into the §3.1 chain but have NO signal_sources mappings
-- — they're chain leaves that accumulate but never derive signals.
-- Reading scripts/rls-audit.mjs and the Coach v3 readout code shows
-- this is intentional per asset A4 (surface uncertainties; defer
-- them to §4 evidence), but the table didn't reflect that decision.
-- An outside auditor reading signal_sources alone could only see
-- "these events emit nothing" — indistinguishable from accidental
-- omission.
--
-- This migration inserts ENABLED=FALSE rows for each orphan event
-- kind, with `notes` explicitly stating the §4 question the
-- deferral exists to answer. The chain's actual contract becomes
-- legible from the table itself rather than from comments scattered
-- across migration files.
--
-- A12 discipline: ON CONFLICT (event_kind, signal_kind) DO NOTHING
-- on every INSERT — re-running this migration against any partial
-- state is a clean no-op. Adding a real (enabled=true) row for any
-- of these kinds in a later migration would conflict and fail,
-- which is the correct behavior — disabled markers and active
-- mappings should not coexist for the same (event_kind, signal_kind)
-- pair.
--
-- A4 discipline: each `notes` field states the §4 readout question
-- the deferral is waiting on, not "TODO" or "future work." The
-- distinction matters — A4 says deferral is honest, vagueness is
-- not.

-- ─── Coach.* events ───────────────────────────────────────────
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('coach.suggestion_offered',
   'coach_offered_deferred',
   'coach:${payload.citation.id}',
   'Deferred per A4. §4 question: does offering Coach chips correlate with downstream topic durability (held vs reopened)? If yes, ''offered'' becomes a true signal. If no, the offered count is engagement metric only and stays here as documentation.',
   false),

  ('coach.suggestion_accepted',
   'coach_accepted_deferred',
   'coach:${payload.citation.id}',
   'Deferred per A4 + A11. §4 question: does click-through on Refine correlate with durable resolutions, OR is acceptance distinct from consequence (the A11 mirror frame is explicit that acceptance ≠ consequence)? Only consequence-correlated acceptances become signals.',
   false),

  ('coach.suggestion_dismissed',
   'coach_dismissed_deferred',
   'coach:${payload.citation.id}',
   'Deferred per A4. §4 question: which heuristics have high dismiss rates (false positives — the regex over-fired) and which have low (real catches the user kept)? Per-heuristic dismiss rate is the calibration signal for vocabulary.ts and the LLM prompt in /api/coach/analyze.',
   false),

  ('coach.pattern_observed',
   'coach_observed_deferred',
   'coach:${payload.heuristic_id}',
   'Deferred per A4. §4 question: does pattern_observed frequency in a topic correlate with topic durability outcomes? Currently used as a count input to the mirror chip threshold; whether it should ALSO be a signal_kind feeding problems is the open question.',
   false),

  ('coach.enabled',
   'coach_topic_lifecycle',
   'chat_topic:${payload.topic_id}',
   'Deferred per A4. §4 question: do coached topics have measurably different outcomes (resolution durability, time-to-close, participant satisfaction) than uncoached topics? Coach v3 ships company-wide so the A/B is degraded; tracked here to surface when the question is answerable.',
   false),

  ('coach.disabled',
   'coach_topic_lifecycle_off',
   'chat_topic:${payload.topic_id}',
   'Paired with coach.enabled — see notes there. The disable lifecycle is the negative control if/when a clean A/B becomes available.',
   false)
on conflict (event_kind, signal_kind) do nothing;

-- ─── Decision.* events ────────────────────────────────────────
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('decision.opened',
   'decision_opened_deferred',
   'chat_topic:${payload.topic_id}',
   'Deferred per A4. §4 question: do opened-but-not-decided dialogues correlate with topic stalling (no further messages within N days), or with team alignment (the dialogue itself surfaces consensus and the formal decide step becomes unnecessary)? Both readings are coherent; the data answers.',
   false),

  ('decision.phase_entered',
   'decision_phase_deferred',
   'chat_topic:${payload.topic_id}',
   'Deferred per A4. §4 question: do phase-skipping patterns (Situation → Decide without Elicit) predict shallow decisions (low durability)? If yes, the trigger emits a real problem.opened signal flagging the dialogue as needing review.',
   false),

  ('decision.system_responded',
   'decision_system_responded_deferred',
   'chat_topic:${payload.topic_id}',
   'Deferred per A4. §4 question: when the System''s suggested action gets adopted (chosen_path=system) vs critiqued (chosen_path=user/hybrid), are downstream resolution durabilities materially different? Tests the §3.3 hypothesis that guide-don''t-overtake produces better outcomes than directive AI.',
   false),

  ('decision.decided',
   'decision_decided_deferred',
   'chat_topic:${payload.topic_id}',
   'Deferred per A4. §4 question: which chosen_path (user/system/hybrid/defer) produces the most durable downstream resolutions? Pairs with chat.topic_durability_reviewed already-active signal mapping to close the consequence loop on every recorded decision.',
   false)
on conflict (event_kind, signal_kind) do nothing;

-- ─── Task.* events (deferred set) ─────────────────────────────
-- task.created, task.status_changed, task.reassigned, task.priority_changed,
-- task.blocker_recorded already have active signal_sources rows from 0006.
-- The following four fire but have no mapping.
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('task.gate_cleared',
   'task_gate_cleared_deferred',
   'task:${payload.task_id}',
   'Deferred per A4. §4 question: does gate-clearing correlate with task completion rate vs non-gated tasks (the v1.0 baseline)? Tests the §3.2 Understanding Gate hypothesis — that requiring Pillar 1 answers produces more completable work.',
   false),

  ('task.nudge_sent',
   'task_nudge_deferred',
   'task:${payload.task_id}',
   'Deferred per A4 + A7. §4 question: do admin nudges actually move work forward (status change within 72h of nudge) vs not nudging? Tests the Pillar 2 team-check digest hypothesis — that A7-framed constructive nudges produce engagement without producing surveillance fatigue.',
   false),

  ('task.system_message',
   'task_system_message_deferred',
   'task:${payload.task_id}',
   'Deferred per A4. §4 question: are system-emitted task messages (status changes, gate clearings) signal or noise? Their presence in the message stream may add legibility OR distract from human-authored content. Held until a clear use case emerges.',
   false),

  ('task.participant_added',
   'task_participant_added_deferred',
   'task:${payload.task_id}',
   'Deferred per A4. §4 question: does adding participants mid-task correlate with faster completion (more capacity), slower completion (coordination overhead), or no measurable effect? Pairs with task_participants.engagement_count to test the Pillar 2 ''meaningful action'' hypothesis.',
   false)
on conflict (event_kind, signal_kind) do nothing;
