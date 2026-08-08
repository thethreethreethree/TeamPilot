-- 0209 — Raise the ELOSTATE (vendor/home) tenant's care conversation quota.
--
-- WHY (founder decision 2026-08-09, FOUNDER-ACTION-QUEUE "CARE quota"): the
-- care monthly_conversation_quota defaults to 200 for every tenant (0038),
-- including ELOSTATE's own. The ELOSTATE-hosted widget (no embed token) resolves
-- to this tenant (src/app/api/care/conversations/route.ts:28), so elostate.com's
-- own care widget was 429-throttling real prospects past 200 conversations/month
-- ("contact the site owner" — where ELOSTATE IS the site owner). This is the
-- vendor-not-exempt sibling of the extension-entitlement bug fixed in 9f846350.
--
-- The founder chose option 1: RAISE the quota rather than fully exempt the vendor
-- (a code exemption would remove the cost-abuse ceiling on a public widget). 10000
-- is 50x the current cap — far above any legitimate widget volume at this stage —
-- while retaining a bounded cost ceiling against runaway abuse. Trivially raised
-- again if ever approached.
--
-- Data-only, single-row, idempotent (running again sets the same value). Hardcodes
-- the ELOSTATE company id, same as 0038/0089; other environments harmlessly match
-- zero rows. A12 idempotent.

update care_tenant_config
set monthly_conversation_quota = 10000
where company_id = 'c3e7f389-3df6-48c8-876b-0cd4baf5c2a7'::uuid;
