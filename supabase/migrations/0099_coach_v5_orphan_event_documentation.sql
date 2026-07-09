-- 0099 — Document POST-0026 orphan event kinds as A4-deferred signal_sources
--
-- (Filename says "coach_v5" loosely; the accurate scope is below.) Extends the §1.7
-- audit that produced 0026 (2026-06-12) to every event kind added AFTER 0026 that
-- fires into the §3.1 chain (the `events` table) with NO signal_sources mapping.
-- Verified 2026-07-09 (each inserts into `events`, zero signal_sources row). An
-- auditor reading signal_sources alone sees "these emit nothing," which 0026
-- established is indistinguishable from ACCIDENTAL omission; this makes the deferral
-- intentional and legible, as 0026 did for the pre-sales coach/decision/task kinds.
--
-- SCOPE (corrected after a 2026-07-09 §3.4 self-check that caught three kinds first
-- mislabeled as sales-live-telemetry from their NAMES — the §5 confident-quick-answer
-- trap; each §4 question below was re-derived from the VERIFIED emit semantics):
--   • SALES coach (sales-session subjects): dissect / summary / pivot / moments /
--     intel / sales_review / after_pitch_summary / debrief / why_patterns /
--     session_why_recorded / session_why_generated / session_decision /
--     session_status_changed / session_outcome_recorded.
--   • COMMUNICATION coach (chat message grading): message_graded / analyze_returned.
--   • CONTROL-CYCLE honesty mechanism (§3.4): control_skipped — flagged as a likely
--     ENABLED mapping, not a pure deferral (see its note).
--   • Cross-cutting: mention.created (the one non-coach post-0026 orphan).
--
-- Same disciplines as 0026:
--   - ENABLED=FALSE on every row: pure documentation. NO signal is derived; there
--     is zero behavioral change. The derivation trigger reads `enabled = true`.
--   - A4: each `notes` field states the concrete §4 readout question the deferral
--     is waiting on — a real consequence question, never "TODO"/"future work"
--     (0026's A4 discipline: vagueness is not honest).
--   - A12: ON CONFLICT (event_kind, signal_kind) DO NOTHING — re-running is a clean
--     no-op, and a later real (enabled=true) mapping for any pair will correctly
--     conflict-fail rather than silently coexist with a disabled marker.
--
-- SCOPE: the same 2026-07-09 sweep that found the Coach v5 orphans also checked
-- every other namespace emitting into `events` (asset.*, decision.*, mention.*).
-- asset.* and decision.* are already fully documented (0026 + the asset migrations);
-- the ONLY other undocumented chain orphan was `mention.created`, folded in at the
-- end of this migration so one file closes the whole post-0026 orphan set.
--
-- NOTE (founder review): the §4 questions below are DRAFTED from each event's
-- evident purpose + the constitution's measurement framing (§3.5 consequence,
-- §A11 mirror-not-verdict, §A18 owner-privacy, §3.3 guide-don't-overtake). They
-- are proposals — edit any before applying if the intended §4 question differs.
-- Applying as-is is safe (enabled=false); the value is legibility, not behavior.

-- ─── Post-call review artifacts ───────────────────────────────
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('coach.dissect_generated',
   'coach_dissect_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4. §4 question: does a rep REVIEWING their post-call Dissect correlate with measurable improvement (ELO gain / higher close-rate) in subsequent sessions vs sessions with no dissect-review? If yes, dissect-review becomes a leading coachability signal; generation alone is only an artifact count.',
   false),

  ('coach.session_summary_generated',
   'coach_summary_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4. §4 question: is summary GENERATION itself signal, or only its derived content (pivot/moments, which carry their own deferred rows)? Held as the lifecycle marker those content signals hang from until they prove out.',
   false),

  ('coach.session_pivot_generated',
   'coach_pivot_deferred',
   'sales_session:${payload.pivot.direction}',
   'Deferred per A4. §4 question: does a detected LOST pivot predict a rep''s declining trajectory or a recurring coachable weakness (vs gained/none)? If yes, lost-pivot could feed a problem.opened signal flagging the rep pattern for a manager — pairs with the 2026-07-09 interaction-flags surface, which reads pivot per-session but not per-rep-trajectory.',
   false),

  ('coach.session_moments_generated',
   'coach_moments_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4. §4 question: does net-COOLING timeline sentiment across a rep''s sessions LEAD a drop in close-rate — an early-warning signal surfaced before the outcome metric moves? The moment sentiment is manager-visible (§A18-safe), so a team-level signal carries no score leak.',
   false),

  ('coach.session_intel_generated',
   'coach_intel_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4. §4 question: do captured objections/competitors RECUR across reps (a team-level enablement pattern worth a problem.opened signal) vs stay session-local? Recurrence, not presence, is the signal — held until cross-session intel aggregation exists.',
   false),

  ('coach.sales_review_generated',
   'coach_review_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4 + A18. §4 question: the After-Pitch SCORE is OWNER-PRIVATE (0080 RLS — managers get null). Any signal derived from it must aggregate WITHOUT per-rep leak. Does team-level score-trajectory predict outcome durability? Kept deferred until an aggregate-only derivation that cannot expose an individual score is designed (A18 is load-bearing here).',
   false),

  ('coach.after_pitch_summary_generated',
   'coach_after_pitch_summary_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4. §4 question: is the after-pitch summary''s content a DISTINCT signal from the score, or a restatement of it? Held until the score''s own consequence question (coach.sales_review_generated, above) is answered — the same A18 privacy constraint applies.',
   false),

  ('coach.debrief_generated',
   'coach_debrief_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4. §4 question: does generating/reading a debrief correlate with rep improvement, or is it a comfort artifact? Same coachability question as coach.dissect_generated on a different surface — the two should be answered together so their overlap is not double-counted.',
   false),

  ('coach.why_patterns_generated',
   'coach_why_patterns_deferred',
   'sales_agent:${payload.agent_id}',
   'Deferred per A4. §4 question: do recurring "why" patterns across a rep''s sessions identify a STABLE coachable weakness worth a problem.opened signal at the rep level? Subject is sales_agent (not session), so any signal is rep-scoped and surfaces to the rep + their manager per the growth surface (A18 — rep-private, not org-broadcast).',
   false)
on conflict (event_kind, signal_kind) do nothing;

-- ─── The "why" dialogue (§3.3 guide-don't-overtake instrument) ─
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('coach.session_why_recorded',
   'coach_why_recorded_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4 + A11. §4 question: does the GAP between the rep''s own recorded ''why'' (this event, captured FIRST per §3.3) and the system''s generated ''why'' (paired event below) predict coachability vs resistance? This is the direct measurement of the §3.3 hypothesis that eliciting the human''s model before asserting the System''s produces better learning.',
   false),

  ('coach.session_why_generated',
   'coach_why_generated_deferred',
   'sales_session:${payload.session_id}',
   'Deferred per A4. §4 question: paired with coach.session_why_recorded — see there. The (recorded, generated) pair is the §3.3 measurement UNIT; neither is a signal alone.',
   false),

  ('coach.session_decision',
   'coach_session_decision_deferred',
   'sales_session:${payload.chosen_path}',
   'Deferred per A4. §4 question: which chosen_path in a session decision produces the most durable downstream sales outcome? The session-scoped analogue of decision.decided (0026), which tests the same §3.3 guide-don''t-overtake consequence question in the chat surface. Answer both together so the guide-vs-directive finding is not surface-specific.',
   false)
on conflict (event_kind, signal_kind) do nothing;

-- ─── Communication coach (chat message grading) ───────────────
-- CORRECTION (2026-07-09 self-check): message_graded + analyze_returned are the
-- COMMUNICATION coach (the ELOSTATE chat-message coach), NOT sales-session events —
-- verified at coach/v5/grade-sent + coach/v5/analyze (subject is the chat context,
-- not a sales_session). Their §4 questions are corrected accordingly.
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('coach.message_graded',
   'coach_message_graded_deferred',
   'chat:${payload.message_id}',
   'Deferred per A4 + A11. §4 question: does a team''s message-grade MIX (productive / neutral / needsGuidance) trajectory correlate with downstream TOPIC DURABILITY (held vs reopened) — i.e., does the communication coach''s per-message grade actually predict better team outcomes, or only measure surface compliance? A11 anchor: grade is the coach''s READ, durability is the CONSEQUENCE; only a grade→durability correlation makes grade a real signal rather than vanity.',
   false),

  ('coach.analyze_returned',
   'coach_analyze_returned_deferred',
   'chat:${payload.context_type}',
   'Deferred per A4. §4 question: which communication PRINCIPLES (payload.principle / book) recur as needs_improvement across a team''s messages — a coaching-CURRICULUM signal for what the team most needs to learn — and do rising principle-application rates correlate with fewer clarification cycles / more durable resolutions? Measures the coach''s TEACHING effect on consequence (§3.5), never suggestion-acceptance (A11 — consequence, not agreement).',
   false)
on conflict (event_kind, signal_kind) do nothing;

-- ─── Control-cycle honesty mechanism (§3.4) ───────────────────
-- CORRECTION (2026-07-09 self-check): control_skipped is NOT a rep dismissing a live
-- cue — it is an ADMIN skipping the MONTH-1 CONTROL PERIOD (emitted at
-- CoachTogglePanel; payload days_into_cycle / reason; subject company). This is a §3.4
-- honesty-moat event and is materially more consequential than a deferred readout — so
-- it is flagged, not silently parked.
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('coach.control_skipped',
   'coach_control_skipped_deferred',
   'company:${payload.days_into_cycle}',
   'Deferred per A4 — but FLAGGED for the founder as a likely ENABLED mapping, not a pure deferral. This event records an admin BYPASSING the month-1 control period — the clean baseline the entire §3.4 no-instant-results thesis rests on. §4 question: does skipping the control measurably degrade the ATTRIBUTABILITY of the month-2 intervention (contaminated baseline → wider confidence intervals on every downstream gain claim)? Unlike the other rows here, a "signal" from this is a DATA-QUALITY WARNING that should arguably attach to every subsequent measurement for that company — i.e., it may warrant a problem.opened (degraded-attribution) mapping rather than deferral. Founder decision.',
   false)
on conflict (event_kind, signal_kind) do nothing;

-- ─── Session lifecycle ────────────────────────────────────────
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('coach.session_status_changed',
   'coach_session_lifecycle_deferred',
   'sales_session:${payload.to_status}',
   'Deferred per A4. §4 question: is the active→ended→reviewed lifecycle itself signal — e.g., ended sessions never manager-REVIEWED = a coaching-COVERAGE gap worth surfacing — or plumbing? Held until manager-review-coverage is a tracked metric; the reviewed transition is the candidate signal, not the ended one.',
   false),

  ('coach.session_outcome_recorded',
   'coach_session_outcome_deferred',
   'sales_session:${payload.outcome}',
   'Deferred per A4. §4 question: the outcome already drives the 2026-07-09 interaction-flags as a per-session column read; does it ALSO belong as a SIGNAL feeding the diagnosis chain — a rep''s no_sale STREAK → problem.opened? The flags surface it per-session; the open question is per-rep-trajectory, which is a different derivation.',
   false)
on conflict (event_kind, signal_kind) do nothing;

-- ─── Non-coach post-0026 orphan (same sweep) ──────────────────
insert into signal_sources (event_kind, signal_kind, source_template, notes, enabled) values
  ('mention.created',
   'mention_created_deferred',
   'user:${payload.target_user_id}',
   'Deferred per A4. §4 question: does INBOUND @-mention volume on a person proxy a coordination bottleneck / key-person dependency — i.e., work routing THROUGH one individual (an over-centralization signal the System exists to diagnose) — vs ordinary collaboration? The subject is the source (message/task); the candidate signal keys on payload.target_user_id''s inbound rate over time. Held until a per-person inbound-mention baseline exists to distinguish "central" from "overloaded."',
   false)
on conflict (event_kind, signal_kind) do nothing;

-- ─── End migration 0099. ──────────────────────────────────────
