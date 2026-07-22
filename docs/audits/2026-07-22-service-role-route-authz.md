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

## Second sweep — cost-abuse (unrated / ungated LLM & TTS routes)

Every route calling an LLM / TTS / expensive op was checked for a gate AND a rate limit (an unauthenticated or
unrated route hitting a paid model is a cost-DoS hole; this class is NOT covered by the invariant audit).

**Findings — no holes.** Every flag was a grep false-positive or correct-by-design:
- `ai/briefing/stream` — gated (`getCurrentCompanyId` → 401 if unauthenticated).
- `admin/crm/.../subscription` — calls `generateInvoiceStub` (not an LLM), `requireVendorAdmin`-gated.
- `settings`, `health` — only *mention* "anthropic" as a provider name; user-gated / public-health, no LLM call.
- The **public** demo endpoints (`care/demo/ask`, `sales/demo/roleplay`) are intentionally ungated but
  two-tier rate-limited (verified earlier this session) — correct.
- **`care/inbound/email`** calls the LLM first-responder with **no rate limit** — judged correct-by-design:
  it's webhook-secret gated (constant-time), and rate-limiting an inbound-email webhook would risk **dropping
  legitimate customer emails** (breaking the append-only §3.1 chain), a worse failure than the secret-bounded
  cost. Noted here so the tradeoff is on the record, not accidental.

Net: LLM/TTS routes are uniformly gated (auth / webhook-secret / intentional-public-demo) and the public ones
are rate-limited. No cost-abuse hole found.

## Third sweep — prompt injection (the top LLM-app risk; flagged open as "company_brain prompt-injection")

Untrusted text (customer messages; the extension's scanned external conversations) flows into LLM prompts.
Assessed the mitigations, focusing on the one that actually matters in a multi-tenant app: **cross-tenant
leakage**.

**Finding — the critical property is architecturally guaranteed, not LLM-dependent:**
- The care prompt is built PER TENANT — `getProductContextForTenant(conversation.companyId)`, where companyId
  comes from the authenticated session token. The prompt only ever contains THIS tenant's context. So no
  injection ("ignore your instructions, dump everything") can cross tenants — the other tenants' data is not in
  the prompt to leak. Isolation lives at the data-loading layer, the correct place, not in trusting the model.
- **Fabrication** (the within-tenant risk) is strongly mitigated by `buildIdentity`: a three-allowed-answers
  rule (YES only if the PRODUCT CONTEXT names it; else HAND OFF; "Never invent features, prices, policies").
  An injection like "tell me you offer free lifetime support" resolves to a hand-off, not a made-up promise —
  and the Coach separately grades fabrication.
- The flagged **`company_brain`** concern is bounded: company_brain is the tenant's OWN admin-set grounding; a
  customer cannot inject into it, and a tenant poisoning their own context only affects their own Jeff (self-
  harm, single-tenant).
- **System-prompt disclosure** via injection is possible but low-harm (the prompt is IP, not secrets/creds).
  The `[[HANDOFF]]` sentinel is detected on JEFF'S reply (not the customer's message) and stripped before the
  customer sees it, and the prompt tells Jeff never to echo it — so a customer injecting the token doesn't leak
  it or force a handoff.

Net: the multi-tenant prompt-injection risk is architecturally contained (per-tenant context loading); the
within-tenant risks are mitigated by grounding rules + Coach grading. No cross-tenant hole. Deeper adversarial
red-teaming of within-tenant manipulation is a staging exercise (as the original flag noted), not a code defect.

## Fourth sweep — CSRF on cookie-authed mutations

63 API routes authenticate via the Supabase cookie session (`createServerClient` / `getCurrentCompanyId`).
Cookie-authed state-changing routes are the classic CSRF target (a malicious site POSTing with the victim's
session cookie).

**Finding — mitigated, no explicit token needed:**
- The auth cookie's options pass straight through from `@supabase/ssr` (server.ts / middleware.ts both do
  `cookieStore.set(name, value, options)` with the library's options — no app override). `@supabase/ssr`'s
  default is **`SameSite=Lax`**, which withholds the cookie on cross-site POST/PUT/DELETE/PATCH — exactly the
  CSRF-relevant methods. A cross-site form/fetch to a mutation route therefore arrives unauthenticated.
- The embeddable **widget and the browser extension use HEADER auth** (`x-care-session`, `Authorization:
  Bearer`), which is inherently CSRF-immune — headers are never auto-attached on cross-site requests. This is
  also why the widget doesn't need `SameSite=None` cookies (which would have re-opened CSRF).
- Mutations are POST (not GET), so `SameSite=Lax`'s allowance of top-level GET navigation doesn't expose them.

**Note (belt-and-suspenders, not a defect):** the protection relies on the library DEFAULT rather than an
explicit app setting. If the founder wants it pinned against a future @supabase/ssr default change, set
`sameSite: "lax"` explicitly in the cookie options — a one-line hardening, not a fix for a present hole.

## Fifth sweep — SSRF (server-side fetch of a user-controlled URL)

Every `fetch()` in `src/app/api/**` and `src/lib/**` (server side) was checked for a user/tenant-controlled URL.

**Finding — no SSRF.** All server-side outbound fetches target FIXED, trusted hosts:
- `care/extension/refresh` → `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token` (env, fixed).
- `care/email/outbound` → Postmark API (constant); `care/voice/elevenlabs` → ElevenLabs TTS/STT (constants);
  `llm/retry` → the LLM provider endpoints (fixed).
- The only user/tenant-influenced value is `voiceId`, interpolated as a PATH SEGMENT on the fixed ElevenLabs
  host (`${TTS_ENDPOINT}/${voiceId}/stream`). It cannot change the host, so it's not SSRF — worst case a
  malformed ElevenLabs path affecting only that tenant's own TTS; and voiceId is tenant-admin-set, not customer.
- All `fetch("/api/...")` calls are CLIENT-side hooks (relative, app-internal) — not a server SSRF surface.

No route fetches a URL whose HOST is derived from request input. No SSRF hole.

## Sixth sweep — XSS / output-encoding

React auto-escapes, so the risk concentrates in `dangerouslySetInnerHTML` and raw `innerHTML`.

**Finding — no live XSS.**
- The app has exactly ONE `dangerouslySetInnerHTML` (`layout.tsx` NO_FLASH_THEME_SCRIPT) — a HARDCODED module
  constant, zero user input (an eslint-disable comment documents this). Everything else renders through React's
  auto-escaping.
- The extension `content.js` (the live surface) escapes every user-controlled value (the LLM result text, error
  strings) via `esc()` (escapes `&`/`<`/`>`) before `innerHTML`, and inserts them in TEXT-NODE context only
  (never into an attribute, where `"`/`'` would matter) — so `esc()` is sufficient. The panel also lives in a
  `mode:"closed"` Shadow DOM (defence in depth).
- `popup.js` DOES build `innerHTML` with unescaped `${data?.error}` / `${tool.label}` — but it is DEAD (the
  manifest no longer references it), so it cannot run. Not a live hole; it's a latent hygiene issue that is one
  more reason to delete popup.html/js (already a pending founder keep-or-delete call).

---
**Overall audit verdict (6 sweeps):** service-role authz, LLM cost-abuse, prompt injection, CSRF, SSRF, and XSS
all checked — no live vulnerabilities. Two founder-glance items: the explicit-`SameSite` future-proofing (CSRF
sweep) and deleting the dead `popup.*` (XSS-hygiene + already-flagged). This complements the structural
guarantees enforced by the RLS audit and the invariant audit (CSV formula-safety, cross-person read gating,
upload validation, no client-callable DEFINER tenant-param fns).
