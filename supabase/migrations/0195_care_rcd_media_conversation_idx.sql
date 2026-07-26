-- 0195_care_rcd_media_conversation_idx.sql
--
-- Missing index (found 2026-07-26, after 0194 was already applied). Both hot RCD-media read paths
-- filter care_rcd_media by conversation_id:
--   • GET /api/care/rcd/[id]      — `care_rcd_media ... where conversation_id = $1`
--   • the retention purge cron     — `care_rcd_media ... where conversation_id in (...)`
-- but 0194 only indexed care_rcd_media on (message_id) and (company_id, captured_at). So both queries
-- do a sequential scan filtered by conversation_id — fine at a handful of rows, a real cost at scale.
-- Adding the covering index. 0194 is already applied, hence a follow-up migration rather than an edit.
--
-- Idempotent (A12): create index if not exists.

create index if not exists care_rcd_media_conversation_idx
  on care_rcd_media (conversation_id);

-- ─── End migration 0195. ─────────────────────────────────────────────────────
