# Closure — C.A.R.E extension "not working" audit + remediation + sidebar revision (2026-07-27)

Governed by the founder's Build/Audit/Solution protocol (`Thinkerthinker Build Key.MD.txt`).

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

## Founder runtime-verify queue (things I structurally cannot run)

- Fresh pilot tenant → first extension tool call now succeeds + opens a 14-day trial.
- The "C.A.R.E Tools" group expands/collapses and looks right.
- Set `CRON_SECRET` (+ `RCD_RETENTION_DAYS`) to activate the purge crons.
- Confirm which of Finding 1 vs 2 the tester hit (401-vs-402 + `select plan, extension_trial_started_at …`).
