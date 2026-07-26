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

## Founder runtime-verify queue (things I structurally cannot run)

- Fresh pilot tenant → first extension tool call now succeeds + opens a 14-day trial.
- The "C.A.R.E Tools" group expands/collapses and looks right.
- Set `CRON_SECRET` (+ `RCD_RETENTION_DAYS`) to activate the purge crons.
- Confirm which of Finding 1 vs 2 the tester hit (401-vs-402 + `select plan, extension_trial_started_at …`).
