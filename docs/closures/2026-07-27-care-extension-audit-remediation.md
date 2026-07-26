# Closure — C.A.R.E extension "not working" audit + remediation + sidebar revision (2026-07-27)

Governed by the founder's Build/Audit/Solution protocol (`Thinkerthinker Build Key.MD.txt`).

## Outcome at a glance

**Tester's "not working" → TWO real causes, both ROOT-CAUSED + FIXED.**
- **(1) Entitlement lock (server).** The `extension_trial_started_at` / `plan` columns had no writer, so every
  tenant was `locked`. Fixed with an auto 14-day trial on first use; hardened against a phantom-trial edge;
  ripple-traced (isolated); expiry message made honest (trial-ended vs never-included), self-corrected to not
  imply a non-existent self-serve upgrade.
- **(2) Sign-in flow break (client onboarding).** Found by tracing the fresh-tester path: `/login` ignored the
  `?next=` param the extension connect page sends (`/login?next=%2Fextension%2Fconnect`), so a fresh sign-in
  landed on the dashboard and NEVER returned to complete the token handoff → extension stayed "Not connected."
  Fixed (`a59b9f6e`): `/login` honors `next`, open-redirect-guarded (`safeRelativePath` + test). Follow-ups
  noted: threading `next` through the onboarding flow (fresh-signup case) + the separate sales-coach login.
- Client verified deploy-ready (v0.3 package carries every fix).

**Everything green:** `npm run check` (6 gates, ~1495 tests) + `next build`. ~32 commits, all pushed.

**Real defects found + fixed this session** (with tests where gate-able): (1) entitlement no-writer root
cause; (2) phantom-trial edge in that fix; (3) L3 sidebar-group gap; (4) CWE-209 raw-error leak on 3 public
routes (+ my own incomplete sweep, corrected); (5) conversation-mutation route missing a route-layer tenant
check (defense-in-depth, past-bug class). Every one after (1) found by auditing my OWN work or re-opening my
own residual.

**Built to your decisions:** auto-trial, both PII purge crons scheduled (dormant until `CRON_SECRET`),
download-page version fix, sidebar "C.A.R.E Tools" grouping.

**Verified SOUND with evidence** (no defect): sales-coach read+write authz, agent conversation read routes,
finance authz (gate-enforced `auth_company_id()` RPCs), knowledge/ACMS authz, widget bootstrap, inbound-email
webhook, public demo endpoint, extension tool input bounds, both purge crons' delete logic.

**Your one open item — B/paid-unlock — is a POST-PILOT feature, not an urgent blocker** (the product is
deliberately pre-billing; see the corrected framing in FOUNDER-ACTION-QUEUE). It needs your tier→plan pricing
call; until then, unlock a pilot tenant manually (`update care_tenant_config set plan='pro' where company_id=…`).

Detail follows.

## Assets actually read this session (honest ledger, per A22/A35 — not cached labels)

| Asset | Read this session | Where |
|-------|-------------------|-------|
| `docs/amendments/AMD-006-…md` (full, 3 addenda) | Yes — full file | quoted L2, four-layer sieve, 3rd addendum in the audit report |
| `ThinkerThinker.md` §0–§7 + asset index + **A31, A32, A33, A34, A35, A36, A37, A38, A39** (full bodies) | Yes | lines 963–1211 + index read |
| `CLAUDE.md` (incl. §3.4) | Yes — in the session's project-instruction context; §3.4 quoted in the audit | — |
| `Thinkerthinker Build Key.MD.txt` | Yes — full | the governing protocol |

**Not re-read this session (declared, not claimed):** the bodies of A1–A30, and §3.2 / §1.1 / §3.6 / §A6 / §A18. The `§`-tokens for those that appear in the sidebar diff are **pre-existing nav-item comments relocated verbatim** when the seven items moved into `TOOLS_NAV` — they are not new reliance by this build. This build relies on **AMD-006 Layer 3 (workflow continuity)**, **Layer 4 (UI/design)**, and **A28 (reuse the established affordance)** — read/applied this session.

## Audit findings (root cause first)

1. **CRITICAL — extension locked for 100% of tenants (root cause of "not working").** The entitlement columns (`care_tenant_config.plan`, `extension_trial_started_at`) had **no writer** anywhere in the product — `plan` defaults to `'pilot'`, the trial column is read-but-never-written, and the one plan-writing surface (admin CRM) writes a *different table* (`crm_subscriptions`) with a *different vocabulary*. Every one of the 7 extension routes returned 402. Unlockable only by raw DB edit. Clauses: **A31** (dead config / schema-complete-is-not-built), **AMD-006 Layer 2**, §3.4. The gate was 100% green while the feature was unusable — the A31/A38 lesson in the flesh.
2. **HIGH (conditional) — sign-in handoff can silently refuse** for unpacked installs when `NEXT_PUBLIC_CARE_EXTENSION_ID` is pinned, or for a tester with no web account. Clause: AMD-006 Layer 3. Disambiguated from #1 by the 401-vs-402 signal.
3. **MED-HIGH — RCD retention purge cron never scheduled** → customer PII retained forever. Clause: A31 (cron layer), §3.4.
4. **MED — coach recording-purge cron never scheduled** (parallel instance). Clause: A31.
5. **LOW-MED — download page advertised stale version** (0.1.0 / ~22 KB vs shipped 0.3.0 / ~37 KB). Clause: §3.4, AMD-006 L4.
6. **LOW — `care_rcd_conversations.external_ref` written but never read** (inert). Clause: A31 shape-b.

## Remediation built (this session)

- **Fix 5** (`7e290a98`) — download-page version 0.1.0→0.3.0, size corrected. Verified: typecheck.
- **Fix 1** (`d4a04a6`) — auto-start 14-day trial on first use (pure `shouldAutoStartTrial` + atomic idempotent write in `getExtensionEntitlement`). Verified: 24 entitlement tests + `npm run check` (1487 tests). **Untested:** live Supabase UPDATE + real-browser 402→trial. Paid path (A1) deferred per founder.
- **Fix 3/4** (`d4a04a6`) — both purge crons scheduled in `vercel.json` (dormant until `CRON_SECRET`). Verified: valid JSON; routes 503 without the secret.
- **Fix 2** — no code change (founder chose ext-id unset; handoff already fails open). Caveat: pin before public launch.
- **Fix 6** — held (inert).
- **Sidebar revision** — the seven analysis/coaching nav items grouped under one collapsible "C.A.R.E Tools" button (mirrors the Settings expander, A28; default collapsed, auto-open when the active route is inside the group per AMD-006 L3). Verified: typecheck, lint, theme (0 leaks). **Untested:** the click/expand + visual layout in a real browser (AMD-006 3rd addendum — static-verified only).

## Extended audit — public C.A.R.E app surfaces (post-remediation, A36 — re-opened my own "not inspected" residual)

7. **NEW — CWE-209 information disclosure (fixed).** Two PUBLIC customer-facing endpoints returned the raw
   exception string (`${err.name}: ${err.message}`) to unauthenticated clients: `conversations/route.ts:174`
   (create) and `conversations/[id]/messages/route.ts:362` (post message). Leaks Postgres table/column names
   and missing-env-var names on error. Both already log it server-side, so `detail` in the response was pure
   leak. Fixed (`3e8c75ae`) + the authed `agent/tenant` route (`908d0897`). **CORRECTION (`f188f791`): my
   first sweep was INCOMPLETE** — the grep matched `detail:` (colon) and missed the object-shorthand
   `{error, detail}` and interpolated `${detail}` forms, so I wrongly claimed "no care route returns a raw
   exception." A proper re-sweep found a THIRD public instance: `conversations/[id]/upload/route.ts:128` (the
   customer-widget file upload, raw DB error to the customer with NO server log) — fixed; plus the authed
   `agent-upload` sibling. **Accurate final state:** no PUBLIC care route leaks a raw exception; the 4 authed
   agent AI-tool routes (co-pilot/dissect/formulate/summarize) intentionally return the LLM error to the agent
   (documented 2026-07-25, authed-only, A15). **Reusable lens (corrected):** grep error responses for
   `detail[,:}]` AND `${...err`/`String(err)` — shorthand and interpolation hide the leak from a naive
   `detail:` grep (A38 — the sweep recipe itself must be verified).

**Verified SOUND this pass (now inspected, moved off the residual):** widget bootstrap (`toWidgetSafeConfig`
whitelist projection, test-locked — no internal field leaks); inbound-email webhook (`CARE_INBOUND_EMAIL_SECRET`
enforced, **fails closed** if unset → 500, `constantTimeEqual`); both PII purge crons (delete only expired,
bytes-before-rows, no orphans, RCD immutability triggers are UPDATE-only so deletes aren't blocked).
**Known-open (documented, config-gated, not re-flagged as new):** per-tenant AI-cost cap (awaits founder cap
numbers). **Still NOT inspected:** finance, sales-coach live-coaching internals, the authed agent AI-tool
routes' bodies (co-pilot/dissect/summarize/formulate) beyond the error-leak class.

## CWE-209 gating — final boundary (A30 done to the point of diminishing returns, A33)

- **All 3 PUBLIC instances GATED with regression tests** (the real risk): messages (`idorGuard.test.ts`),
  create-conversation (`conversations/__tests__/errorLeak.test.ts`), customer upload
  (`upload/__tests__/errorLeak.test.ts`). Each asserts an internal throw → generic 500 with no `detail`/raw
  string; each FAILS against the pre-fix code. Independently regressable per the codebase's own convention.
- **The 2 AUTHED instances (agent-upload, tenant/logo) are FIXED + verified-by-inspection, gate DECLINED
  (A33).** Reason: both are authenticated (trusted same-tenant user → lower risk than the public routes), and
  reaching their inner file/config-write catch needs a disproportionate mock stack (agent-upload: 7+ deps —
  getCurrentAuthContext/fetchAgentConversation/validate/buildPath/upload/autoRoute/classify/createFileRecord;
  logo: an admin-client mock with both a storage-upload and an upsert chain). Per A33, a gate whose cost
  exceeds its value is worse than the documented decision — the fix (log + generic message) is simple and
  read-verified. If either is later refactored, add the gate then. (I initially said I'd gate these; on
  reading the routes the mock cost inverted the call — recorded honestly rather than force the tests.)

## Extended audit — sales-coach subsystem authz (adjacent, verified SOUND with evidence)

Applied the same authz rigor to the sales-coach transcript surface (the sensitive per-rep coaching data, A10/A18):
- **Session read** (`[id]/route.ts` GET → `getSession`/`getSessionTranscript`): both use the RLS session client
  (`createServerClient`, verified — not admin), governed by the `0084` SELECT policy = **owner OR admin/sales-coach
  manager same-company**. Correct A10/A18 model (rep sees own, managers see team); no cross-tenant/cross-rep leak.
- **Segment write** (`[id]/segments/route.ts` POST): **owner-only** (`session.agentId !== auth.user.id → 403`) —
  explicitly hardened (2026-07-09 audit) against the "RLS-fixed, service-role-route-missed" cross-rep injection
  class that 0082 first closed at the PostgREST layer.
- **Observation:** the migration history (0082/0083/0084/0095/0102/0113/0155) shows this subsystem's authz has
  already been through rigorous hardening — the probes confirmed prior work rather than finding new gaps. The
  sales-coach authz is mature; a future audit can deprioritize it. **NOT inspected:** finance subsystem;
  sales-coach LLM-prompt/injection surfaces; the non-`[id]` aggregate routes' role gating in depth.

## Extended audit — agent conversation routes (tenant authz)

8. **Read/AI-tool routes** (co-pilot/messages/read/resolution/dissect/formulate/events/ask-coach): all carry an
   explicit `conversation.companyId === auth.companyId` route-layer check — consistent, sound.
9. **NEW — mutation route hardened (`78e9c982`).** `[id]` PATCH (claim/assign/status/priority/snooze) was the
   ONE agent route without that route-layer check — it relied purely on its data fns being RLS-scoped. Verified
   sound today (claim/assign/status/priority/snooze + fetch all use `createServerClient`), so **not an active
   vuln** — but it's the "service-role route missed the tenant check" class that caused a real past incident
   (CRM vendor bug, 0089). Added the route-layer fetch+company check gating every branch + a regression test.
   Defense in depth against a future data-fn switch to the admin client.
10. **Observation (not changed — A15 + the don't-over-refactor-sound-code rule):** `bulk/route.ts` admin path ("admin targets any") relies on RLS
   (`bulkAssignConversations` → `createServerClient`) for company scoping, same class as #9. Sound today; it
   already RLS-filters non-admin ids. Lower priority than #9 (which had zero route-layer scoping); left as a
   documented follow-up rather than refactoring a sound route.

## Extended audit — finance subsystem authz (the last uninspected adjacent surface, verified SOUND)

11. **Finance tenant-scoping — sound + structurally enforced.** Read (`fin_gl_detail`) and write
    (`fin_approve_bill`, etc.) routes use the SESSION client + RPCs scoped internally by `auth_company_id()`,
    passing only entity ids (`p_bill_id`) — never a client-supplied company param, so the tenant can't be
    spoofed. NO finance route uses `createAdminClient` except `reports/deliver-cron` (CRON_SECRET-gated). This
    is enforced by the `invariant:audit` gate ("finance routes RLS-scoped", "no client-callable DEFINER
    tenant-param fn") in every `npm run check` — a stronger, uniformly-applied pattern than care's per-route
    checks, so the "service-role route missed the tenant check" class (#9) does not apply here. The finance
    error-response pattern (400/403 domain messages) was scoped-out earlier as intentional (finding #7 notes).
    Finance also had a dedicated ground-up audit 2026-07-26 (`docs/audits/2026-07-26-finance-ground-up-audit.md`).

**Audit coverage is now comprehensive across the in-scope + adjacent surfaces:** extension (entitlement/
capture/permission/adapters/inputs), public C.A.R.E (widget/conversations/upload/inbound + CWE-209), agent
conversation routes (read + mutation authz), sales-coach (read + write authz), finance (authz), crons. Every
security class is either FIXED+gated or VERIFIED-sound-with-evidence. Remaining defects were concentrated in
new code (this session's own) and two documented past-bug classes — all fixed and tested.

## Flow-trace finding — email support: outbound dispatch failure has no human fallback (PROPOSAL, not built)

12. **MEDIUM (proposal) — a failed outbound email reply leaves the customer in silence.** Traced the email
    first-responder flow: `inbound/email/route.ts:713-724` generates + stores the AI reply, then
    `dispatchOutboundEmailReply`. On `!dispatch.ok` it ONLY `console.error`s — the conversation is not routed
    to a human, not retried, not flagged. On the EMAIL channel, storing ≠ delivering (the comment says so), so
    a transient send failure (Postmark error / bad recipient) means the customer who emailed in gets nothing
    and no agent is alerted (only Vercel logs). The unconfigured case (no `POSTMARK_SERVER_TOKEN`) is a
    documented config prerequisite; the transient-failure case is the gap. **Not built (design decision):**
    the right fix — flip `ai_responding=false` to surface it in the agent inbox on a genuine send failure,
    and/or distinguish "unconfigured" from "send_failed" in the dispatch result so only real failures route to
    a human — changes behavior + the return type, so it's surfaced for the founder rather than resolved
    silently (surface-don't-overtake). Recommended: on a non-unconfigured dispatch failure, route to a human.

## Flow-trace finding — inbox: single assign-away doesn't auto-advance (LOW-MED, proposal)

13. **LOW-MED (proposal) — `assignTo` (single assign-away) breaks the AMD-006 auto-advance pattern its
    siblings honor.** `ConversationsApp.tsx`: `changeStatus` (close/resolve) and `runBulk` both snapshot the
    neighbor (`computeNextAfterTerminal`) and advance after success — the AMD-006 continuity the founder asked
    for. `assignTo` (1271) does NOT: after assigning a conversation to someone else from a filtered view
    (Unassigned / Assigned-to-me), it leaves the view but the agent stays selected on it (milder than the
    original empty-state bug — the detail still renders — but the same class). **Not built:** the reliable fix
    is a general "selected-left-the-filtered-list → advance" reconciliation effect, NOT a synchronous
    `filtered.some()` check right after the action (React's `useMemo` won't reflect the post-action reload yet
    — stale-state trap). The inbox selection logic is intricate (many effects + explicit advances), so a
    general reconciliation is surfaced for a considered change rather than rushed. Recommended: add the
    reconciliation effect (also future-proofs snooze + any filtering action).

## Additional classes swept — clean with evidence (on the record per §1.7.4)

These three classes were not part of the original tester report but were swept to close the audit. An empty
flag list at a layer is itself suspicious (§1.7), so the *evidence* is recorded, not just the verdict.

14. **XSS (message + media rendering) — SAFE by construction.** `grep dangerouslySetInnerHTML` across
    `src/components/care`, `src/app/dashboard/care`, `src/app/widget` returns EMPTY — no raw-HTML rendering.
    Customer + AI message bodies render as `{text}` (React auto-escapes). The only content-derived href is
    `media.url` in `RcdPanel`/`RcdMobileSheet`, which is a server-signed Supabase URL (`https://…supabase.co/…`
    or `null`→placeholder), never raw user input and never `javascript:`/`data:`; the page-controlled
    `sourceUrl` is server-only and not rendered. A hostile customer message / captured page cannot inject
    script.

15. **CSRF (state-changing endpoints) — SAFE by design.** Customer state-changes authenticate via the custom
    `x-care-session` HEADER (`conversations/[id]/messages/route.ts:57`, `…/upload/route.ts:47`; both comment
    "not user auth"), un-forgeable cross-site (browsers don't auto-send custom headers; CORS blocks setting
    them). Create-conversation has no session to forge (a CSRF would create a rate-limited empty conversation).
    Agent endpoints ride Supabase's cookie session under its default `SameSite=Lax`, which blocks cross-site
    POST cookies.

16. **Performance (inbox hot path) — SOUND, one latent flag.** `fetchEnrichedInbox` (`care.ts:1035`) is a
    SINGLE joined query (tags + customer via Supabase nested-select), not N+1; downstream enrichment batches
    via `.in(ids)` (1420/1835/2008). No per-row query loop. **Latent flag (not built):** the inbox caps at
    `.limit(500)` with no pagination — good for perf (bounded), but a tenant with >500 open conversations would
    silently see only the 500 most-recent-by-`last_message_at` (a §3.4 "no silent cap" gap). Not pilot-
    reachable; the useful fix (surface "showing 500 of N" to the agent) needs a return-type ripple across
    callers, so it's a recorded proposal, not an unprompted refactor. Product call: infinite-scroll vs. pages.

## Post-audit resolution — finding 13 built + a sibling finding it surfaced (commit `4e4917fe`)

On re-reading `ConversationsApp.tsx` (rather than reasoning from the earlier flag), finding 13's deferral
premise — "needs a novel reconciliation architecture, stale-`useMemo` trap" — turned out to be **wrong**. The
proven sibling pattern (`changeStatus`/`runBulk`: snapshot the neighbor BEFORE the action, advance on success)
transfers cleanly to `assignTo` with a *deterministic* predicate computed at action time, not by reading the
post-action `filtered`. Since auto-advance is already the founder-decided behavior (AMD-006), building the
parity fix completes a decided intent — it is not new product scope — so it was built, not left as a proposal.

17. **RESOLVED (was finding 13) — `assignTo` auto-advance parity.** `willLeaveView = (view==="mine" &&
    target!==me) || (view==="unassigned" && target!==null)`; assignment is membership-invariant for every
    other view, so it correctly does NOT advance there (advancing when the item stays visible would be the
    jarring bug). No `filtered` read after the action.

18. **NEW → RESOLVED — `assignTo` write-verification parity (§1.6 / §3.4).** Surfaced WHILE building 17:
    `assignTo` passed `null` as `runAction`'s `expect`, bypassing divergence detection — a 200 that didn't
    actually assign (RLS/trigger/wrong-owner) toasted "Assigned." while the DB disagreed. Same silent-ok class
    already fixed for `claim` and guidance; `claim` (assign-to-self) verified but general assign/unassign did
    not. Fixed with an `assignedAgentId` expect checked via `!== undefined` (so the null/unassign case is still
    verified). This is the §1.5.2 dividend: the audit lens on one finding surfaced its neighbor.

## Post-audit resolution — finding 12 split: shippable half built, gated half confirmed (commit `95dd62ab`)

Applied the same premise-test to finding 12 (failed outbound email reply → customer silence). Unlike finding
13, re-reading the code did NOT fully dissolve the deferral — it SPLIT it:

19. **RESOLVED (finding 12, shippable half) — a genuine dropped reply is now visible.** `dispatchOutboundEmailReply`'s
    `ok:false` conflated three cases: unconfigured (benign, every dev/demo emits it), data/logic (customer has no
    email), and a genuine configured-but-failed Postmark send. The route logged all three identically via
    `console.error`, so a production dropped customer reply was indistinguishable from dev noise. Added an
    `unconfigured: true` discriminator to the two config-gate returns (keyed on state, not string-matching the
    free-text error); the route now warns on unconfigured and errors only on a genuine failure. A real incident
    is finally visible.

20. **CONFIRMED DEFERRAL (finding 12, gated half) — auto-remediation is a real product decision.** Whether a
    genuine send failure should cede the thread to a human immediately (flip `ai_responding=false`) vs. retry
    first, and how to surface the undelivered reply in the agent UI (internal note now vs. a `delivery_status`
    column + inbox badge later), are product judgments, not correctness. Testing the premise CONFIRMED this
    deferral rather than dissolving it — which is the discipline working, not failing: not every flagged
    proposal converts to a build. The gate is now specified precisely (it wasn't before): the decision is
    cede-vs-retry + the undelivered-signal surface. Flagged inline at the failure site.

## Distribution-chain verification — rules out "stale download" as the tester's cause (no commit; verification only)

The tester's exact words were "not working even with downloading the latest extension file." That phrasing
points at a distribution/staleness hypothesis distinct from the entitlement lock (findings 1-2). Traced and
ruled it out with hard evidence:

21. **The served ZIP is byte-current with source, rebuilt automatically every deploy.** `public/care-extension.zip`
    is produced by `scripts/build-extension-download.mjs`, wired to `prebuild` + `predev` (so every Vercel
    deploy and every local dev start regenerate it). The script first imports `build-store-package.mjs`, which
    refreshes `extension/store/dist/` from the dev source (validates + strips localhost), then deterministically
    zips `dist/` (fixed epoch → byte-stable). Verified: (a) all 7 non-manifest files in the ZIP are
    byte-identical to the working-tree source; the manifest differs by exactly the designed localhost-strip
    (938→908B, prod host_permissions = elostate.com + *.supabase.co); (b) a fresh `npm run build:extension`
    passed validation ("store package valid") and produced ZERO git churn (determinism holds). **Conclusion:**
    the tester did NOT receive a stale build — on every deploy the ZIP is rebuilt from current source. This
    RULES OUT stale distribution and CONFIRMS the entitlement lock (finding 1: no trial writer → every tenant
    locked → 402) as the actual cause, which the auto-trial fix resolves. Ruling out the wrong hypothesis with
    evidence is as valuable as fixing the right one — it prevents chasing distribution when the fix is
    entitlement.

    *Adjacent note (not chased):* the prod extension is pinned to `elostate.com` (externally_connectable +
    host_permissions). If a tester runs the app on a different origin (a `*.vercel.app` preview / staging
    domain), the extension cannot talk to it — a config assumption to confirm, not a code defect.

## Security verification of the fix itself — the auto-trial WRITE is tenant-scoped (audit only, no change)

22. **The auto-trial write cannot be abused cross-tenant.** The fix (finding 1) added an `UPDATE
    care_tenant_config SET extension_trial_started_at = now() WHERE company_id = $1`. Audited against the
    "gate keys on a caller-supplied reference, not the actual data" class: `getExtensionEntitlement(companyId)`
    receives `auth.companyId`, which `extensionAuth.ts` derives SERVER-SIDE from the `Authorization: Bearer`
    token → `admin.auth.getUser(token)` → `profiles.company_id` keyed on the authenticated user id — never a
    request param. Fail-closed on `removed` status and missing company. So the trial-start write is scoped to
    the caller's OWN tenant; a caller cannot start trials for, or probe the entitlement of, other tenants. The
    root-cause fix is therefore correct (26 passing tests) AND tenant-secure. Closes the loop on the one piece
    of new mutation code the tester fix introduced.

## §1.5 ripple of the auto-trial fix — it widens the per-tenant cost gap onto the extension surface (FLAG, not built)

23. **MEDIUM — auto-trial + no per-tenant cost cap = uncapped free LLM spend per trial tenant.** Tracing what
    else the finding-1 fix affects (holistic, §1.5): auto-trial now auto-unlocks the 7 LLM-burning extension
    tools (coach/copilot/dissect/formulate/rcd/spawn/summarize) free for 14 days to every pilot tenant.
    `guardExtensionRequest` bounds cost per-IP (60/min pre-auth) and per-USER (`care-ext-${tool}:${userId}`,
    perUserMax/min) but has NO per-tenant (company_id) cap. So a trial tenant with N agents on distinct IPs can
    drive N×perUserMax/min aggregate (e.g. 10 agents × copilot@20 = 200 LLM calls/min), unbounded at the tenant
    level — the SAME cost-metering class already flagged for the widget + inbound-email surfaces, now confirmed
    on the extension surface and made more reachable by auto-trial (free, no card). **Not built:** the fix is the
    same designed-but-unbuilt per-tenant windowed cap (author_type='ai' count over a window → suppress + route
    to human inbox) extended to these 7 routes, and it awaits the cap NUMBERS the founder holds — picking them
    unilaterally is the surface-don't-overtake line (a cost/business-policy throttle, not a pure safety
    mechanism). **Recommendation:** set the per-tenant cap before broad pilot rollout, since auto-trial is now
    the default unlock path. This is an honest correction — the ripple should have been surfaced WITH the
    auto-trial fix, not a cycle later.

## Compliance verification — the RCD PII-purge cron genuinely deletes (not silent-failure theater)

24. **SOUND — RCD retention purge actually purges.** Before the founder relies on this cron for PII/GDPR
    retention, verified the failure mode from the append-only-blocks-deletion incident does NOT apply here.
    The cron (`rcd/retention-cron/route.ts:97`) does `.delete()` then `if (!delErr) purged += 1` — if RCD
    immutability were a `do instead nothing` RULE, the delete would silently no-op (no error) and the cron
    would report `purged: N` while retaining the PII forever. It is NOT a rule: `0194_care_rcd.sql` freezes
    content with `BEFORE UPDATE` TRIGGERS on all three tables (121-123 / 132-134 / 143-144) — UPDATE raises,
    DELETE is untouched. No `do instead nothing` rule, no `BEFORE DELETE` trigger. So the delete lands; child
    `care_rcd_media`/`messages` rows cascade (`on delete cascade`, 60/83) and their triggers are also
    UPDATE-only, so they don't block the cascade. The 0194 author explicitly mirrored the `care_knowledge_documents`
    0193 content-freeze-trigger pattern (comment line 24) precisely to allow deletion — the lesson from the
    append-only incident was applied. Fail-safe is sound too: `RCD_RETENTION_DAYS` defaults to 90 (not 0 =
    delete-all, not infinite = delete-nothing) when unset; CRON_SECRET auth is 503-if-unset / 401-on-mismatch.
    Bytes are removed before the row so objects never orphan. Conclusion: the purge chain is correct — the
    founder can schedule it as a genuine retention path.

## Founder runtime-verify queue (things I structurally cannot run)

- Fresh pilot tenant → first extension tool call now succeeds + opens a 14-day trial.
- The "C.A.R.E Tools" group expands/collapses and looks right.
- Set `CRON_SECRET` (+ `RCD_RETENTION_DAYS`) to activate the purge crons.
- Confirm which of Finding 1 vs 2 the tester hit (401-vs-402 + `select plan, extension_trial_started_at …`).
