# Audit — service-role (admin-client) route authorization · 2026-07-22

**Why this audit:** the 2026-07-07 CRITICAL incident (`project_crm_vendor_authz_fix`) taught that *RLS-only
audits miss service-role routes* — a route that uses `createAdminClient()` bypasses RLS and must enforce its
OWN authorization, or it's open. This audit sweeps every API route that uses the admin client and reads the
lowest-authz-signal ones adversarially (§0), since those are where a missing self-authz check would hide.

**Scope:** 31 route files under `src/app/api/**` use `createAdminClient`. A grep for common authz signals
(session/auth/requireX/CRON_SECRET/company-scoping) ranked them; the three lowest-signal were read in full.

## Findings — none. The three lowest-signal routes are SOUND (all grep false-positives):

| Route | Grep signal | Actual authorization (verified §0) |
|---|---|---|
| `care/tts` | 0 | `x-care-session` token → `getCareConversationByToken` (404 if invalid); rate-limited (30/min, cost bound); admin read is scoped to the authenticated conversation's `companyId`. |
| `care/inbound/email` | 0 | Webhook secret in `X-Care-Webhook-Secret`, verified against `CARE_INBOUND_EMAIL_SECRET` with **constant-time** comparison (`constantTimeEqual`) → 401 on mismatch. |
| `care/conversations/[id]/file/[fileId]` | 1 | Session token → conversation; **404 unless `conv.id === url.id`**; file resolved only if **`linked_conversation_id === conv.id`** (no cross-conversation IDOR) AND **`access_role === "everyone"`** (internal/admins-only files can't leak to the customer). |

The "low signal" was entirely because the auth uses varied patterns (customer session tokens, webhook secrets,
conversation-scoping) that a generic authz-keyword grep doesn't match — the same grep-false-positive discipline
noted in the 2026-07-13 and 2026-07-16 audits. Each was confirmed correctly gated by reading the handler.

**Conclusion:** the CRM-class vulnerability (admin client without self-authz) is NOT present in the highest-risk
subset. Higher-signal service-role routes (CRON_SECRET crons, company-scoped reads) carry more authz signal and
were not read in full this pass — a candidate for a follow-up sweep if desired, though the pattern here (every
flagged route sound) is reassuring.
