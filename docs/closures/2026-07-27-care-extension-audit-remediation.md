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

## Founder runtime-verify queue (things I structurally cannot run)

- Fresh pilot tenant → first extension tool call now succeeds + opens a 14-day trial.
- The "C.A.R.E Tools" group expands/collapses and looks right.
- Set `CRON_SECRET` (+ `RCD_RETENTION_DAYS`) to activate the purge crons.
- Confirm which of Finding 1 vs 2 the tester hit (401-vs-402 + `select plan, extension_trial_started_at …`).
