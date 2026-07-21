-- 0188 — C.A.R.E handover capture (founder 2026-07-21).
--
-- SPEC (founder, verbatim intent): when Jeff (the AI first-responder) hands a conversation to a human agent,
-- the customer is told a support agent is joining, and the widget captures the customer's full name, email, and
-- their specific concern (a topic dropdown). The system is also prepared for e-commerce sellers (order tracking,
-- returns, cancellations) with an order-number field. The captured details must be visible to the agent.
--
-- This migration is ADDITIVE ONLY — four new nullable/defaulted columns. It changes NO existing column, read,
-- write, policy, or trigger. Every existing C.A.R.E query keeps working byte-for-byte: the AI reply path, the
-- inbox, claim/handoff, and the widget all read columns that this migration does not touch. The new columns are
-- read only by the handover-capture code shipping alongside this file, which degrades gracefully (isMissingColumnError)
-- until this migration is applied — so code and schema can land in either order without an outage
-- (the 2026-07-03 / 2026-07-17 migration-coupling lesson).
--
-- WHERE THE DATA LIVES:
--   - full name + email  → already on support_customers (name, email); linked via support_conversations.customer_id.
--     No new columns needed — the capture code upserts the customer and sets customer_id.
--   - concern topic + free-text detail + order number → per-CONVERSATION facts (a returning customer can have a
--     different concern each time), so they belong on support_conversations, not support_customers.
--   - business type (general | ecommerce) → a per-COMPANY setting that drives which topic list the widget shows,
--     so it belongs on care_tenant_config next to the other widget config.

-- Per-company business type: chooses the concern-topic list the widget presents and whether the order-number
-- field appears. Defaults to 'general' so every existing tenant behaves exactly as before (general topic set).
alter table care_tenant_config
  add column if not exists business_type text not null default 'general'
    check (business_type in ('general', 'ecommerce'));

-- Per-conversation handoff capture. All nullable — capture is OPTIONAL for the customer (founder: never block
-- them). A conversation with no captured details reads as before.
alter table support_conversations
  add column if not exists handoff_topic        text,  -- machine value from handoverTopics.ts (e.g. 'order_tracking')
  add column if not exists handoff_topic_detail text,  -- the customer's own words when they pick "Other"
  add column if not exists order_number         text;  -- e-commerce order reference, when provided

comment on column care_tenant_config.business_type is
  'C.A.R.E handover capture: general | ecommerce — chooses the concern-topic list the widget shows.';
comment on column support_conversations.handoff_topic is
  'C.A.R.E handover capture: the concern topic the customer selected on the handoff card (machine value).';
comment on column support_conversations.handoff_topic_detail is
  'C.A.R.E handover capture: free-text concern the customer typed when choosing "Other".';
comment on column support_conversations.order_number is
  'C.A.R.E handover capture: order reference the customer provided (e-commerce business type).';
