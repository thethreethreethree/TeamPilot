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

## Seventh sweep — mass-assignment (over-posting privileged fields)

The classic vector: a client posts extra fields (`company_id`, `role`, `is_admin`) that get written to the DB
because the route spreads the raw body into an insert/update. Checked both halves.

**Finding — structurally prevented.**
- The dangerous pattern `.(insert|update)({ ...body })` is **absent** — a repo-wide grep found zero routes that
  spread the parsed body into a write. Every write constructs its columns EXPLICITLY (an allowlist).
- Zod is the second guard: `z.object({...})` **strips unknown keys by default**, so extra client fields never
  even reach the parsed `body`. `.strict()` (used in 20/80 route files) *rejects* unknown keys with a 400 rather
  than silently stripping — a defense-in-depth / bug-surfacing choice, NOT a mass-assignment requirement. The
  60 non-strict schemas are safe because of strip-by-default + explicit-field writes.

No mass-assignment hole. (A consistency pass to add `.strict()` everywhere would surface client bugs earlier but
changes no security posture.)

---
## Eighth sweep — dependency CVEs (`npm audit`)

Unlike the 7 code sweeps, this one found real (transitive) CVEs.

**Fixed (branch `fix/sharp-cve-override`):** `sharp <0.35.0` — **HIGH**, Next's image optimizer, inherited
libvips CVEs (image-processing DoS/RCE). npm's `audit fix --force` would downgrade to Next 9.3.3 (catastrophic
— do NOT run). Correct fix applied: an npm override → sharp 0.35.3, API-compatible with Next 16; `npm install`
clean + `npm run build` green. Exploitability was already low here (`images.remotePatterns: []` → no untrusted
images reach sharp), but it's patched now regardless.

**Surfaced, not forced (5 remaining, all Next-transitive):** brace-expansion / fast-uri / js-yaml (HIGH DoS/
parsing) + postcss / next→postcss (moderate XSS-in-CSS-stringify). These run in **build-time tooling** on the
project's OWN trusted config/CSS — not the runtime request path — so real-world exploitability is ~nil. Their
clean fix is a **Next patch update** when one lands; individual deep overrides risk breaking Next/Tailwind and
aren't worth it for build-time-only tooling.

---
## Ninth sweep — HTTP security headers (clickjacking / MIME / HSTS / CSP)

`next.config.ts` sets a considered header set on every response.

**Present + correct:** `X-Frame-Options: SAMEORIGIN` (clickjacking) on all routes EXCEPT the embeddable C.A.R.E
widget (correctly omitted — SAMEORIGIN there would block the cross-origin iframe); `X-Content-Type-Options:
nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; a locked-down `Permissions-Policy` (camera/geo off,
mic=self for voice); `X-DNS-Prefetch-Control`; and `poweredByHeader: false` (no `X-Powered-By` fingerprint).

**Two gaps, neither a live hole:**
- **CSP** — consciously DEFERRED with a documented reason (a strict CSP breaks Next inline scripts + LLM runtime
  calls; needs a nonce strategy). Reasonable — React auto-escaping already covers the primary XSS vector; CSP is
  defense-in-depth. Left as the doc marks it: a dedicated future change.
- **HSTS (`Strict-Transport-Security`)** — not in the config. On **Vercel** (the primary host) it's set at the
  edge by default, so production is almost certainly covered. But the config also supports a **standalone/Docker
  deploy** (`output: "standalone"`), which would NOT get platform HSTS → an SSL-strip gap there. Recommend adding
  a conservative `Strict-Transport-Security: max-age=31536000; includeSubDomains` to `BASE_SECURITY_HEADERS`
  (safe: the app is HTTPS-only already; omit `preload` unless committing to the preload list). Not done here
  because HSTS is a deployment COMMITMENT (a long max-age is hard to walk back) — the max-age/preload policy is
  the founder's call. **Surfaced in the queue.**

## Tenth sweep — open redirect (`?next=` / post-login destination)

Post-auth redirects are the classic open-redirect vector (redirecting to a user-supplied URL enables phishing).

**Finding — no open redirect.** The login page's `buildDestination()` only ever returns HARDCODED internal paths
(`/dashboard`, `/onboarding`, `/dashboard/feedback`) plus an `intent` query param — it never redirects to a
user-controlled URL. In fact the login page reads only `intent`, NOT `next`; there is no reflected-URL redirect
anywhere in the auth flow.

**Minor UX note (not security):** because login ignores `next`, the connect page's `/login?next=/extension/
connect` link is decorative — after sign-in the user lands on `/dashboard`, not back on the connect page. The
connect copy already says "Sign in first, then come back here," so users aren't misled — just not auto-returned.
If auto-return is wanted later, add `next`-handling to login WITH open-redirect validation (accept only a
leading-`/`, non-`//` relative path). Surfaced, not built (touches the auth flow; current state is honest+safe).

---
**Overall audit verdict (10 sweeps):** service-role authz, LLM cost-abuse, prompt injection, CSRF, SSRF, XSS,
mass-assignment, security headers, and open-redirect — no live code vulnerabilities. Dependency audit — one HIGH
(sharp) fixed on a branch; 5 Next-transitive build-time CVEs surfaced (low real exploitability, fix via Next
update). Founder-glance items: merge the sharp branch; optional explicit-`SameSite`; optional HSTS (standalone
deploy); and (done) the dead-`popup.*` deletion. The application-layer security surface is thoroughly covered;
what remains is external assurance (pen-test, red-team) — not code changes.
This complements the structural guarantees enforced by the RLS audit and the invariant audit (CSV formula-
safety, cross-person read gating, upload validation, no client-callable DEFINER tenant-param fns). The app's
security posture is sound across the classes an application-layer audit can reach; deeper assurance (a
pen-test, adversarial prompt-injection red-teaming) is a staging/external exercise, not a code change.

## Data-integrity spot-check — the double-entry ledger's core invariant

Beyond security, a §0 read of the highest-stakes correctness invariant (finance: debits MUST equal credits) —
a subtle break there is real money error, and tests don't always cover a direct-write path.

**Finding — airtight, enforced in the DB at multiple layers (migration 0118):**
- Per-line CHECK constraints: `debit XOR credit` (`(debit>0) <> (credit>0)`) and non-negative.
- A **DEFERRABLE constraint trigger re-asserts BALANCE at COMMIT** for any posted entry — so even a direct SQL
  write cannot leave a posted entry unbalanced (the T-8 backstop; the gold-standard place to enforce this).
- `base_debit`/`base_credit` are **server-computed by trigger**, never client-trusted (closes the "client lies
  about base currency" hole).
- Posted entries are immutable (reverse, don't edit); >=2 lines required; approver != creator; open-period gate.

The ledger integrity is enforced at the correct layer (the database), not left to application code — no bug, and
notably robust. Consistent with the invariant audit's finance-schema-reachable / RLS-scoped checks.
