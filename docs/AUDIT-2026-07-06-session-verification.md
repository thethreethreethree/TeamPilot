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
- **N+1 sweep (2026-07-06, applying the fluidity-build audit's "same class
  elsewhere" discipline):** `getCueRelianceSeries` was N+1 — a `count` per session
  in a loop (interactive read) → **FIXED** to 2 queries (`32e4a0b`). Same-class
  instance in `afterPitch.ts:179` (`appendCueOutcome` per inferred outcome in a
  loop) — **diagnosed ACCEPTABLE per A15, not fixed**: bounded (~5–20 cues),
  post-call assembler (not a hot/interactive path), each insert's returned row is
  used; the batch-insert refactor isn't worth it (§1.5). Crons
  (`durabilitySweep`/`dissectBackfill`) + `brain/learn` do bounded per-item writes
  in background cycles (acceptable). `observe.ts` batches its insert (clean).

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

## Security headers

The 2026-06-02 audit flag (empty `next.config.ts`) is RESOLVED — every response
now carries X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff),
Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control (plus poweredByHeader
off, standalone output). Two remain:
- **CSP** — deliberately DEFERRED, documented in-code (`next.config.ts` L60-62): a
  strict CSP blocks Next's inline scripts + the LLM runtime calls; needs a nonce
  or allowlist strategy + a report-only rollout. Not a blind add. ✅ (known)
- 🟡 **HSTS** — absent. Recommended (founder to add — it's a browser-CACHED
  commitment, so confirm the domain + all subdomains are HTTPS-only first, esp.
  for the `output: standalone` non-Vercel deploys where the platform won't add
  it): `Strict-Transport-Security: max-age=63072000; includeSubDomains` (omit
  `preload` — it's hard to reverse). Flagged, not committed blindly.

## Dependency vulnerabilities (npm audit)

2 moderate CVEs, both the same root: `postcss <8.5.10` (XSS via unescaped
`</style>` in CSS stringify, GHSA-qx2v-qp2m-jg93), bundled transitively inside
**Next**. 🟡 Assessment: practical exposure is **negligible** — the vuln triggers
when postcss stringifies UNTRUSTED CSS, but here it only processes the app's own
Tailwind/CSS at BUILD time, never runtime user input. ⚠️ **Do NOT run
`npm audit fix --force`** — it "resolves" this by installing **next@9.3.3**
(down from 16), a catastrophic breaking downgrade. Correct fix: a future Next
minor that bumps its bundled postcss. No action needed now beyond not taking the
trap fix.

## Secret handling

No secret is client-exposed or logged. All four `NEXT_PUBLIC_` vars are
legitimately public — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, the
RLS-gated `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (a
public key). The service-role key, LLM provider keys, and webhook/cron secrets
stay server-side (no `NEXT_PUBLIC_` prefix) and are not written to console. ✅

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

---

## 2026-07-07 extension — read-audit of the async/delivery surfaces

A focused read-audit (THINK-first per §1.5.2, then confirm) of surfaces the
2026-07-06 sweep didn't reach. Findings and clean results both on the record
(§1.7.3/§1.7.4). Full detail + founder decisions in
[FOUNDER-ACTIONS-2026-07-06.md](FOUNDER-ACTIONS-2026-07-06.md).

**C.A.R.E inbound-email / routing — a coupled race cluster (root-caused + fixed).**
The inbound route fired `routeNewConversation` fire-and-forget, so the
customer-message notify (reads `assigned_agent_id`) and the AI first-responder
(reads `ai_responding`) both raced routing's write. Consequences on a fresh email:
the auto-assigned agent got NO push (notify read null → silent early return), and
the AI proceeded despite an assignment (§3.3 — masked today only by the outbound
gap below). **Fixed** (`6e1bb5a`): await routing before both reads. Non-outward-
facing. `routeNewConversation`'s `ai_responding` coupling — previously
zero-coverage — is now pinned by `care.routeNewConversation.test.ts` (`03264fb`).

**C.A.R.E email AI first-responder — 🔴 layer-2 gap, FOUNDER-GATED.** The AI writes
a reply row but never dispatches it outbound (`dispatchOutboundEmailReply` is
called only from the human-agent route). So the AI "first responder" never reaches
the customer. Flagged not fixed — wiring it makes the AI autonomously email real
customers (outward-facing). Recommendation + corrected (non-trivial) fix recorded.

**Push delivery — VERIFIED SOUND end-to-end (§A15), no code bug.** `sender.ts`,
the root `public/sw.js` (app-wide push handler), and `useNotificationSubscription`
(subscribes via root SW + migrates stale narrow-scope subs) all correct. Open
queue #2 narrowed to VAPID config; the `[push-sender]` log names which cause.

**CRM append-only (§3.1) — audited, SOUND.** `crm_activity_events` is populated by
0049 DB triggers (account bootstrap, account lifecycle, subscription change,
invoice) and hardened to immutability by 0086 (`do instead nothing`). It's a
billing-lifecycle log by design; entity deletes (contacts, notes) are legitimate
mutable-entity management outside that scope — NOT a §3.1 violation. The append-only
discipline is correctly *scoped* to where history-as-asset matters, not
cargo-culted onto every table. A clean result, on the record per §1.7.3.

**Multi-tenant read isolation (§1.7 foundation) — verified SOUND through the
stack.** `rls:audit` proves a policy EXISTS per op but not that reads are correctly
scoped, so this checked the deeper question (THINK-first: where would a cross-tenant
read leak hide?) through three layers: (1) the audit allowlist has ZERO `.select`
exemptions — 37 delete / 23 update / 7 insert, 0 select — so no company-data read
was quietly exempted from needing a policy; (2) no `using (true)` over-permissive
policy exists anywhere; (3) SELECT policies scope via `auth_company_id()` /
`company_id`, and the linchpin `auth_company_id()` (0001:86) is correct + hardened:
`security definer` WITH `set search_path = public` (blocks search-path injection),
and fail-closed on a NULL `auth.uid()` (unauthenticated → sees nothing). The single
biggest first-customer risk — a cross-tenant leak — is structurally sound. Clean
result on the record per §1.7.3. (Not exhaustively per-policy-predicate audited;
the linchpin + allowlist + no-`using(true)` cover the highest-leverage failure
modes.)

WRITE isolation checked too (the parallel risk — injecting rows into another
company): `with check` predicates are 20 `exists`-subquery (parent-scoped child
tables) / 16 `company_id` / 16 `auth_company_id` / 8 `auth.uid` (user-owned), and
ZERO `with check (true)`. Same linchpin, same correct scoping — a user can't write
into another company any more than they can read from it. Isolation is sound in
both directions.

**§3.1 / §3.2 core guarantees — now integration-tested (were relied-on, untested).**
Added to `chain.integration.test.ts` (`npm run test:chain`): §3.2 understanding gate
(blocks surfacing under threshold, allows once met) and §3.1 immutability (UPDATE/
DELETE are no-ops on events AND signals). Verified the enforcement from source first
(§A22): the gate trigger fires on both the draft→non-draft UPDATE and direct
non-draft INSERT and can't be bypassed by client role; immutability is `do instead
nothing` rules. Protects the foundation against the silent-migration-regression class
(the 2026-07-03 outage shape).

**2026-07-07 security sweep (THINK-first by vulnerability class).** Beyond the
isolation check above, swept four known classes:
- **SECURITY DEFINER search_path** — scanned all 71 definer functions;
  `task_message_emit_event()` (0021) was the SOLE one missing `set search_path`
  (Supabase "Function Search Path Mutable" class). FIXED in migration 0088
  (metadata-only ALTER, 🟡 low exploitability in the authenticated-role context).
- **PostgREST `.or()` filter injection** — 4 sites interpolated user search input
  into raw `.or(...ilike...)` strings (global search, CRM, files, C.A.R.E similar).
  FIXED as a class (§A13) via `sanitizeOrIlikeTerm` + tests (`675cdc4`). The 3 other
  `.or()` sites interpolate DB-sourced UUIDs (`id.eq.`) — safe by type.
- **Stored XSS via `dangerouslySetInnerHTML`** — 2 usages, BOTH clean: a static
  theme script (layout) and a `Section` title fed only static developer strings
  (used to render HTML entities, never user data). No finding.
- **SSRF via stored push endpoint** — the subscribe route accepted `z.string()
  .url()` (any URL) for the push endpoint, which sender.ts later POSTs to
  server-side. An authenticated user could register an internal target (cloud
  metadata / loopback / RFC1918) → blind SSRF. FIXED with `isSafePushEndpoint`
  (https-only + reject internal IP literals) wired into the subscribe schema +
  tests. Legitimate push hosts (incl. fcm.googleapis.com) pass cleanly. Swept ALL
  server-side fetch sinks (§A14): the push endpoint was the ONLY user-controlled
  URL fetched server-side; every other fetch uses a hardcoded/env host (Postmark,
  ElevenLabs, DeepSeek, Supabase) — so the fix is complete, not a one-spot patch.
- **Multi-tenant isolation** (above) — read + write, sound through the stack.
- **LLM cost / rate-limit** — only the already-flagged inbound-email endpoint is
  unrate-limited (health/settings match the grep as CONFIG refs, not LLM calls).
- **Mass assignment / privilege escalation** — CLEAN. The one spread-into-insert
  (`chats.ts`) spreads a server-CONSTRUCTED object (company_id + created_by from
  server ctx, not user input); the codebase builds insert objects field-by-field,
  so a user can't set a privileged field or override tenant.
- **Open redirect** — CLEAN. Every `redirect()`/`NextResponse.redirect()` uses a
  hardcoded internal path; no `?next=`/`?redirect=` user-controlled redirect source
  exists; middleware `dest` is a static ternary.
- **CSRF** — CLEAN. No custom/permissive CORS (the one `useCORS` is an html2canvas
  option, not a header); cookie-auth is mitigated by SameSite + JSON-body APIs. A
  few GET routes do get-or-create upserts (non-ideal REST) but they're
  idempotent server-default creation (often admin-gated), near-zero CSRF impact.

Net (9 classes): 3 real hardenings shipped (0088 definer search_path + the `.or()`
injection guard + the SSRF guard), 6 verified clean. Not an exhaustive pentest —
the highest-leverage classes for a multi-tenant first-customer launch.

**Accessibility pass (this session's live surfaces).** FIXED: the live Sales Coach
cue had no `aria-live`, so a screen-reader rep running visual-only (TTS off) got
NOTHING — added a persistent `sr-only` assertive live region (`a39f90f`). Verified
CLEAN: icon-only buttons carry `aria-label`s (the strict icon-only-unlabeled grep
found zero; the C.A.R.E sound toggle is labeled). OPEN (polish, deferred): the
C.A.R.E message thread has no `aria-live`, so a new customer message isn't announced
to a screen-reader agent — but it's FUNCTIONAL (the chime alerts + the list is
navigable), so this is optimization not a break. The clean fix (a persistent
sr-only region driven by the same `hasNewCustomerMessage` trigger the chime uses)
touches the core inbox poll, so it's flagged for founder-prioritized care rather
than changed autonomously.

**Gate at extension end:** 326 tests passing / 9 skipped (integration, live-DB
gated), typecheck + lint + rls:audit (0 missing) green; production build clean.
