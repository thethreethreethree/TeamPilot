# Session verification record — 2026-07-06

> Consolidated outside-view audit (§1.3) covering everything verified across this
> session, so §1.7.4 (audits on the record) is satisfied in one place and future
> audits can compare. Companion to the two focused audits from the same day:
> [live-attribution](AUDIT-2026-07-06-sales-coach-live-attribution.md) and
> [append-only-enforcement](AUDIT-2026-07-06-append-only-enforcement.md).
> Answers CLAUDE.md checklist #9 (last audit + open flags).

## Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · ✅ verified clean

| Area | What was checked | Result |
|---|---|---|
| **§3.1 immutability** | Is append-only DB-rule-enforced (blocks service-role) or only RLS-deep? | Coaching + core C.A.R.E strong ✅; 2 gaps (care_widget_load_events, crm_activity_events) **hardened** → `0085`/`0086` (unapplied) |
| **§3.2 understanding gate** | Where is "problem needs N signals before surfacing" enforced? | DB-**trigger** enforced (problems/route) — strongest form, unbypassable ✅; JS helper `deriveRetrospectivePatterns` tested ✅ |
| **§3.3/§3.4/§3.5/A11 guards** | Are the coach + grader pure guards regression-protected? | **All pinned** this session — review/dissect/moments/patterns/score tone-law + grounding + A11; C.A.R.E `deriveGrade`/`validateCounts`. 245 tests ✅ |
| **RLS policy coverage** | rls:audit reported 69 gaps | 33 were a **parser false-positive** (unquoted policy names) → fixed `b7e622f`; remaining 25 all verified intentional + allowlisted; **0 missing** ✅ |
| **§A11 CRM healthScore** | Is `healthScore` a forbidden system-derived verdict? | **No** — it's a MANUAL admin field (form input + healthReason), not a machine verdict. Clarified in-code `0948fd3` ✅ |
| **CRM money mappers** | Does `?? 0` on amount_cents/MRR/seat_count mask NULLs? | **No** — all three columns are `NOT NULL default 0`; `?? 0` never fires. health_score is nullable and correctly `?? null` ✅ |
| **CRM invoice numbers** | Can the `count+1` seq mint duplicate invoice numbers under concurrency? | **No** — `invoice_number` has a UNIQUE constraint (0049:195); a collision fails safe (returns null), never duplicates. Documented tradeoff ✅ |
| **C.A.R.E widget origin check** | Could a flawed allowlist match let `evil-yourbusiness.com` embed the widget? | **No** — `allows.includes(origin)` is EXACT array-element match (no substring/prefix bypass); empty origin rejected; `"*"` wildcard honored only in non-prod; Origin header is browser-set (unspoofable cross-origin) ✅ |
| **File upload path traversal** | Can a malicious filename (`evil.x/../secret`) escape the storage prefix? | **No** — `buildStoragePath` uses only trusted segments (companyId=server profile, fileId=randomUUID); the sole user input (extension) is sanitized to `[a-z0-9]` only, capped 12 chars; the raw filename never enters the key. Already tested ✅ |
| **File access IDOR** (`files/[id]`) | Can a user fetch/patch/delete another company's file by id? | **No** — GET fetches via `getFile` on the RLS-scoped user client (same-company only → 404); PATCH/DELETE add an explicit uploader-or-admin-of-same-company check + row-affected verification (a subtle RLS-success-on-blocked bug was already fixed here). Signed download URLs expire in 5 min ✅ |
| **Customer session-token IDOR** | Can a customer guess/forge another's `session_token` to read their conversation/uploads? | **No** — `default gen_random_uuid()::text` (0034): crypto-random 128-bit, server-generated (unforgeable), unique; lookup is exact `.eq()` with empty rejected. No IDOR ✅ |
| **Service-role multi-tenant scoping** | Do service-role routes (RLS bypassed) gate access by company before privileged work? | Coaching `[id]` routes gate via user-client `getSession` (RLS); coaching CONFIG routes (corpus/product/team/voice) operate on the caller's own `ctx.companyId` + an `isManager` gate and FAIL CLOSED on null company; C.A.R.E via explicit check + user-client fetch (RLS). All sound. 🟢→✅ **Found + FIXED** (`5e0f935`): 8 C.A.R.E agent routes' explicit company check failed OPEN on a null company (`auth.companyId && …`); now fail-closed. Not a live vuln (RLS covered it) but a defense-in-depth backstop that was off |
| **Inbound-email injection** (untrusted external + service-role) | Can a spoofed sender inject into any tenant's thread? Auth-bypass on unset secret? | **No** — webhook shared-secret auth with an explicit env-present check (500 on unset, so no `undefined!==undefined` bypass); Zod-validated body; replay dedup on `external_message_id`; tenant resolved by EXACT `inbound_email_local_part` on the To-address (not the spoofable From) ✅ |
| **theme leaks** | theme:audit RED on 25 | **All fixed** (`brand-shell` token + theme-aware text); theme:audit 0 ✅ |
| **lint** | 2 exhaustive-deps warnings | Fixed, incl. a real perf fix (memoized ToastProvider value) `8899c59`; 0 warnings ✅ |

| **Notification cross-tenant leak** | Can `notify-message` notify the wrong company, or be spoofed? | **No** — anti-spoof (only `author_id === auth.user.id` may trigger); the service-role participant fetch is explicitly scoped `eq("company_id", msg.company_id)` ✅ |

## Robustness — LLM-output validation (§3.4)

Swept every module that turns model output into data used downstream, for the
"pass the parsed output through unvalidated" gap. Found + fixed a systematic one
in the System's three core reasoning generators, which returned model arrays raw:
- **§1.3 outside-view** (`6e015bb`) — now drops any reading missing framing /
  whatItChallenges / ifTrueThen.
- **§1.5 ripple-trace** (`5a4edf8`) — now drops any ripple missing its Rule-2 WHY;
  bogus confidence → conservative "low".
- **§3.6 learning cycle** (`a30ada9`) — now skips a malformed distillation item
  rather than writing a null-claim brain row or aborting the cycle.

Verified the rest already validate (drop malformed items): the coach parsers
(review/dissect/moments/patterns/score), `salesPrep`, and the C.A.R.E grader. So
no LLM-output consumer now surfaces or persists unvalidated model items.

## Rate-limit coverage on LLM endpoints (cost / abuse)

16 of 17 LLM-calling API routes are rate-limited. 🟡 **Flag — one gap:** the
inbound-email AI-reply path (`care/inbound/email` → `generateCareReply`) has NO
limit. Mitigated: it's webhook-secret authenticated (not publicly callable) and
retry-deduped on `external_message_id` (no retry storms). Residual risk: a spam
flood to a tenant's inbound address → one LLM call per distinct email, unbounded
(cost/DoS). NOT a mechanical fix — the existing `rateLimit` is IP-keyed, wrong for
a webhook (all calls share the provider IP → would throttle every tenant
together). **Recommended (founder decision — a limit value + degradation
behavior):** a per-tenant (companyId-keyed) cap on AUTO-replies only — ingest +
store every email, but past the cap skip the AI reply and let a human agent
handle it (correct degradation; never drop the email). Needs a tenant-keyed
limiter, so flagged, not built blind.

## Performance (data-layer hot paths)

Checked the frequently-hit read paths for N+1 queries (a query per item in a
loop) — the class that bites at scale. Clean:
- **Enriched inbox** (polled every 5s): ONE query — `support_conversations`
  embedding tags + customer via a PostgREST join, sorted by `last_message_at`,
  `.limit(500)`, mapped in memory. No per-conversation query. The inbox-wide
  chime's `last_message_author_type` rides this existing `*` select — zero added
  queries.
- **Durability + asset readouts**: bulk-fetch then aggregate in memory (Maps/
  Sets over pre-fetched rows) — no query inside any loop.
- Earlier this session: fixed a real render-perf anti-pattern (ToastProvider
  rebuilt its context value every render → memoized, `8899c59`).

## Accessibility (AMD-006 layer 4 — surface)

Spot-checked the Sales Coach interactive surface (the founder's focus): every
button carries a visible TEXT label (Start/Stop, mode toggles, "I'm speaking",
"Coach me now") and its icon is `aria-hidden` — the correct pattern (text is the
accessible name; decorative icons stay silent). No icon-only buttons without a
name. The chime toggle added this session has a state-aware `aria-label` +
`aria-pressed`. Clean.

## Resilience (known past-incident area)

Re-verified the Team Chat read path — the site of the 2026-07-03 RLS outage (a
commit removed a guarded fallback on an unverified "migration applied"). The fix
is solid and in place: a `mode` discriminator distinguishes `live-error` (a real
read failure — surfaced to the UI) from `live-empty` (genuinely no data), with a
degraded base-table fallback when the view is broken/missing, and a failed read
never masquerades as empty (§3.4). The known-fragile area is robust.

## Auth + input-validation coverage

- **Auth**: every API route doing sensitive work authenticates — via
  `getCurrentAuthContext` (super-admin-gated admin/CRM + files), `getUser`,
  `requireCareAgent`, `getCurrentCompanyId`, or a webhook/cron secret. The only
  unauthenticated non-stub is `llm/ping` (an LLM connectivity test used at setup)
  — appropriately controlled by a rate limit (6/min/IP) and ~10 tokens/call
  (negligible cost); the `ai/analyze|decision|finance|marketing` routes are
  410-Gone deprecated stubs. ✅
- **Input validation**: routes validate request bodies (Zod `readBody`/`safeParse`
  where used, else manual `typeof`/non-empty checks + defensive `req.json()
  .catch(() => ({}))` + 400s). No unvalidated field flows to a query/write. Minor
  cosmetic: a few routes `await req.json()` without `.catch()` → 500 (not 400) on
  malformed JSON; both still reject. ✅

## Security posture (observed pattern)

The service-role routes follow a consistent, mature isolation discipline: access
gated by an RLS-scoped **user-client** read (or an explicit company check) BEFORE
any service-role work; anti-spoof author checks; webhook shared secrets with
env-present guards; tenant routing by exact server-side identifiers, never
spoofable client input. The one deviation found (fail-open company check, 8
routes) was hardened to fail-closed (`5e0f935`). This is a strong baseline.

## Open flags

**None constitutional. None critical-security** (the fail-open finding was
fixed). **One 🟡 cost/DoS flag, founder-gated:** the inbound-email AI-reply path
is unrate-limited (see the rate-limit section) — mitigated by webhook-secret auth
+ retry dedup, but a per-tenant auto-reply cap is recommended. Flagged not built
because the fix is a design decision (limit + degradation) needing a tenant-keyed
limiter.

## Owed to the operator (not code)

- Apply migrations `0085`, `0086` (§3.1 hardening, unapplied).
- Live coaching test (the one high-value item code can't cover) —
  [checklist](sales-coach-live-test-checklist.md).

## Baseline note

This sweep extends the ground-up audit of 2026-07-06 (recorded in agent memory).
`npm run check` was green end-to-end throughout the session (typecheck + lint +
theme:audit + rls:audit + 245 tests).
