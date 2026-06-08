-- Conversational Coach v1 — schema scaffolding.
--
-- The Coach is opt-in per topic (§3.3 guide-don't-overtake at the chat
-- surface, ten-books synthesis from the methodology Library). When a
-- topic has coach_enabled = true, the composer surfaces heuristic
-- citations (NVC observation-vs-evaluation, Voss labeling, Stone-Heen
-- identity-collision) as the user drafts. Every offered / accepted /
-- dismissed suggestion becomes an immutable §3.1 chain event so the
-- §4 readout can compare coached vs uncoached topic outcomes 60 days
-- in.
--
-- Why the schema is so light:
--   - Default is OFF (asset A3 — anti-game-your-own-evaluation
--     defaults). Topics created before this migration land with
--     coach_enabled = false naturally via the column default. This
--     gives the §4 readout a clean A/B between coached and uncoached
--     topics.
--   - Events ride the existing `events` table — its `kind` is free-
--     form text so coach.suggestion_* doesn't require a schema
--     change. Subject = chat_topic:<topic-id> with the draft excerpt
--     in payload (drafts aren't persisted, so we can't subject on a
--     draft id).
--   - Deliberately NO signal_sources mapping for coach events. Per
--     A3 (and §3.5 honesty), mapping "user accepted the cite" to a
--     derived signal would measure AGREEMENT with the Coach, not
--     CONSEQUENCE. That's the grading-your-own-homework trap. The
--     §4 readout compares topic-level outcomes (resolution_held vs
--     reopened, time-to-close, message count) between coach_enabled=
--     true and coach_enabled=false topics directly. Coach uptake is
--     a leading indicator we'll look at, not a signal source.

alter table chat_topics
  add column if not exists coach_enabled boolean not null default false;

comment on column chat_topics.coach_enabled is
  'When true, the Conversational Coach (v1) is active in this topic. Opt-in default-OFF per asset A3 so the §4 readout has a clean A/B between coached and uncoached topics.';
