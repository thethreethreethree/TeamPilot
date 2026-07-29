-- 0202_care_assistance_guidance.sql
-- Jeff customer-assistance GUIDANCE (founder 2026-07-30).
--
-- A company's OWN rules for HOW Jeff should assist customers — the methodology-equivalent for customer
-- support (escalation rules, do's/don'ts, handling tone beyond the tone enum, brand posture). This is
-- DISTINCT from:
--   - ai_product_context  → WHAT the business represents (the product), and
--   - the ACMS knowledge docs (0193) → the FACTS Jeff answers from.
-- It is injected into Jeff's system prompt as the business's own assistance guidance.
--
-- Nullable; the config loader reads care_tenant_config via select("*"), so a pre-migration row simply
-- omits this column and the mapper degrades it to null → no guidance block in the prompt (A34, non-breaking).

alter table public.care_tenant_config
  add column if not exists ai_assistance_guidance text;

comment on column public.care_tenant_config.ai_assistance_guidance is
  'Company guidance for HOW Jeff assists customers (the methodology-equivalent for support). Injected into Jeff''s system prompt as the business''s own assistance rules. Distinct from ai_product_context (what) and the ACMS knowledge docs (facts). Admin-set; fillable by document upload.';
