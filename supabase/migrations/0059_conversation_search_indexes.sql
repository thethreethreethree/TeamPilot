-- 0059 — Full-text search indexes for the Conversation Search
-- companion to Asset System v1.
--
-- Per founder red-pen 2026-06-19: search across files,
-- chat_messages, and support_messages — single search box,
-- results grouped by type. WhatsApp/Slack mental model.
--
-- Constitutional sources:
--   • §1.5 holistic — search composes with the existing
--     append-only chains; no schema mutation, just indexes.
--   • §A12 — every index uses CREATE INDEX IF NOT EXISTS.
--   • §A13 — single vocabulary for search; the indexes use
--     the same to_tsvector('english', ...) pattern across all
--     three tables so the query layer is uniform.
--
-- files index lives in 0056 already (gin on title + description).

-- ─── (1) chat_messages body index ────────────────────────────
create index if not exists chat_messages_fts_idx
  on chat_messages using gin (to_tsvector('english', coalesce(body, '')))
  where body is not null;

-- ─── (2) support_messages body index ─────────────────────────
create index if not exists support_messages_fts_idx
  on support_messages using gin (to_tsvector('english', coalesce(body, '')))
  where is_internal_note = false;

-- Internal notes are excluded from the visible search surface
-- (per §A18 — internal notes aren't part of the customer-
-- facing record). They're still queryable separately if a
-- future readout needs them, just not in the unified search.

-- ─── End migration 0059. ────────────────────────────────────
