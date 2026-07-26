# Entitlement write-path — implementation plan (the #1 launch blocker)

> **🟢 STATUS UPDATE 2026-07-27 — Section A (trial start) is BUILT; Section B (paid unlock) is the sole
> remaining gap.** Founder chose **A1 (auto-start on first entitlement check)**; shipped in commit `d4a04a6`
> (`getExtensionEntitlement` now opens the 14-day window via an atomic `UPDATE … WHERE
> extension_trial_started_at IS NULL`, one trial per tenant; `shouldAutoStartTrial` + 8 tests; verified single
> caller, fires only on genuine tool use). So a fresh pilot tenant's first extension call now works (was: 402
> forever). **Two live consequences now in force:**
> 1. **The 14-day cliff is real and ticking.** With A built but B (below) NOT, every tenant **re-locks after 14
>    days** — there is still no writer for `care_tenant_config.plan=pro/enterprise`, and the plan-vocabulary
>    fragmentation in Section B1 means even a paying `team_large` reads locked. **Build B before the first trial
>    cohort expires.**
> 2. **Section C2 (Spawn during trial) is no longer hypothetical.** A1 now actually creates trial tenants, and
>    since the C.A.R.E trial (14d) sits entirely inside the 30-day control window, Spawn is 100% suppressed for
>    every trial evaluator for the whole trial. Decide C2 alongside B.
>
> Everything below about Section A is now HISTORICAL (it describes the pre-build decision); Sections B + C
> remain the open, founder-gated decisions. Full audit: `docs/closures/2026-07-27-care-extension-audit-remediation.md`.


> **✅ TARGETS VERIFIED EXECUTION-READY (2026-07-23, no drift).** Both build targets confirmed present + as
> described: A1's `getExtensionEntitlement` (`src/lib/care/extensionEntitlement.ts`, read side 16-tested) and B1's
> `src/app/api/admin/crm/accounts/[id]/subscription/route.ts` (exists, `PATCH`, `requireVendorAdmin`-gated, already
> carries a `plan` field on a SEPARATE CRM subscription table — B1 adds the one-line `care_tenant_config.plan` sync
> into this already-authz'd route). Prerequisite `0189` verified idempotent/additive. So "A1 + B1" → immediate,
> low-surprise build: two small guarded writes + the panel-copy + Spawn-trial facets (Section C). Nothing stale.
>
> **✅ RE-VERIFIED 2026-07-24 (still no drift).** Independently re-checked every load-bearing claim against
> current code: A1 read logic (`extensionEntitlement.ts` — `PAID_PLANS={pro,enterprise}`, `EXTENSION_TRIAL_DAYS=14`,
> `.toLowerCase()` case-insensitivity, `?? "pilot"` default, missing-column graceful degrade; unchanged since
> 2026-07-22); care `plan` column (`0038:52-53` — `default 'pilot'`, `check in (pilot,starter,pro,enterprise)`);
> CRM tier enum (`0049:125` — `pilot,team_small,team_medium,team_large,enterprise`); the two are SEPARATE tables;
> B1's target route (`admin/crm/accounts/[id]/subscription/route.ts` — exists, PATCH, `requireVendorAdmin`-gated,
> `plan` in body schema); panel copy (`content.js:262` — honest "plan doesn't include… contact your admin"). All
> match. The plan is trustworthy to act on. (DB migration state — `0189` pending — not re-checkable from the
> sandbox; apply per the runbook before the write-path build.)

The extension is `locked` for every tenant because nothing writes `care_tenant_config.plan=pro/enterprise` or
`extension_trial_started_at` (re-verified 2026-07-23: neither is written by any flow; `plan` defaults to `pilot`
forever). Two write-paths must exist. This is the exact plan for each option so that once you pick, I execute
immediately — and the gotchas below should inform the pick.

The read side is DONE and tested: `computeExtensionEntitlement` (pure, 16 tests incl. trial-window boundaries +
case-insensitivity) unlocks on `plan∈{pro,enterprise}` OR `extension_trial_started_at` within 14 days. Only the
WRITE side is missing.

> **Read-path re-verified 2026-07-23 (comprehensive — not just "done").** The auth gate (`requireEntitledExtensionUser`
> → 401/403/402) is fail-closed and order-tested; the IO wrapper `getExtensionEntitlement` has 6 branch tests
> covering every path INCLUDING the exact current-live scenario (migration `0189` unapplied): missing-column →
> plan-only fallback → `locked` for a pilot tenant (no 500), other read error → `locked` (fail-closed for a paid
> feature), and a DIFFERENT missing column is NOT swallowed → `locked` (isMissingColumnError must name OUR column).
> So the extension degrades correctly against today's DB (it returns clean 402-locked, never crashes). The write
> path is the SOLE remaining gap — building it (below) turns the fully-tested read side live.

> ⚠️ **PREREQUISITE: migration `0189` must be applied first.** It adds the `extension_trial_started_at` column
> that A1/A2 write. `0189` is pending (the 2026-07-20 full-apply went through `0187`) — apply it via
> `npm run db:apply` (see FOUNDER-ACTION-QUEUE item 4) BEFORE I build the trial-start write, or the write hits a
> missing-column error. The read side already degrades gracefully if the column is absent (migration-coupling
> fallback), but the WRITE needs the real column.
>
> **✅ 0189 verified sound + zero-risk to apply (2026-07-23):** it is ADDITIVE-ONLY — a single nullable
> `timestamptz` column with `add column if not exists` (idempotent, re-runnable), changing NO existing column,
> read, write, policy, or trigger. No data migration, no backfill, no outage window. Applying it is a clean,
> low-risk step; the only thing it does is enable the trial the write-path will start.

---

## A. Trial start — pick ONE

### A1. Auto-start on first entitlement check *(recommended — matches the pitch)*
- **Change:** in `getExtensionEntitlement(companyId)` (`src/lib/care/extensionEntitlement.ts`), after the read,
  if the tenant is non-paid AND `extension_trial_started_at` is null → `UPSERT care_tenant_config` set
  `extension_trial_started_at = now()`, then treat the trial as started for this response.
- **Gotchas (decide-relevant):** (1) ~~must be an UPSERT — a tenant may have no `care_tenant_config` row yet~~
  **RESOLVED (verified 2026-07-23): the row is GUARANTEED present** — `0045_tenant_bootstrap_triggers.sql` asserts
  the invariant "∀ company → ∃ care_tenant_config row" (bootstrap trigger). AND every column has a default (`plan`
  `'pilot'`, `embed_token` gen_random, quotas/colors/tone/timestamps all defaulted, `0038`), so even a hypothetical
  missing row upserts cleanly. So A1's write is safe as a plain UPDATE or an UPSERT — no missing-row or
  NOT-NULL-constraint failure. (2) idempotent — write only when null, never
  overwrite; (3) non-paid only — never touch a pro/enterprise tenant; (4) the write happens inside a READ path, so
  it must fail-soft (a write error must not break the entitlement read — log + treat as trial-started-now for the
  response, reconcile next call). (5) UX truth: the 14-day clock starts the first time their extension pings the
  server, not when they "decide" to trial — seamless, but the clock can start before they've really used it.
- **Effort:** small. One function change + a guarded upsert. No new route, no UI.

### A2. Explicit "Start your 14-day trial" button
- **Change:** new `POST /api/care/extension/trial/start` (auth + entitled-tenant guard) that upserts
  `extension_trial_started_at = now()` if null + non-paid; a button in the extension panel's locked state and/or
  the C.A.R.E settings page.
- **Trade:** higher intent/consent, cleaner "clock starts when they choose" story; one more click; a bit more UI.

### A3. Start on signup
- **Change:** set `extension_trial_started_at = now()` in the tenant-bootstrap path (onboarding RPC / the
  `care_tenant_config` insert).
- **Trade:** crudest — the clock runs from signup whether or not they ever open the extension. Not recommended.

---

## B. Paid unlock — pick ONE

### B1. CRM-tier → plan sync *(recommended — you already set the tier there)*
- **Change:** wherever the CRM subscription tier is set to a paid tier
  (`src/app/api/admin/crm/accounts/[id]/subscription/route.ts` — vendor-admin gated), also write
  `care_tenant_config.plan = 'pro'|'enterprise'` for that account's company. (The CRM subscription is a SEPARATE
  table today — this adds the one-line sync so "mark them pro in the CRM" actually unlocks the extension.)
- **Gotcha — NOT a rename, a PRICING DECISION (verified 2026-07-23):** the two enums DON'T match. CRM subscription
  tiers are `pilot | team_small | team_medium | team_large | enterprise`; care `plan` is `pilot | starter | pro |
  enterprise`. There is NO 1:1 map, AND the extension unlocks ONLY on `plan ∈ {pro, enterprise}` — so a paid CRM
  tier that maps to care `starter` (or `pilot`) stays **LOCKED**. So B1 needs an explicit tier→plan map that
  encodes WHICH CRM tiers include the extension. **Recommended default (confirm/adjust):** `pilot→pilot` (locked),
  `team_small→pro`, `team_medium→pro`, `team_large→pro`, `enterprise→enterprise` (i.e. every *paid team tier*
  unlocks). If instead the extension is a premium add-on (only larger tiers get it), map `team_small→starter`
  (locked) and the rest→pro. **This is your pricing call — it decides which paying customers get the extension.**
  Also handle the downgrade path (tier drops to `pilot` → plan drops → re-locks). Vendor-admin-only (the route
  already gates on `requireVendorAdmin`).
- **Build-clarity (verified 2026-07-23 — don't conflate two "control month" concepts):** the CRM subscription has a
  `control_month` STATUS (a sales-lifecycle label, `0049`) and the care/companies control gate uses
  `ai_guidance_unlock_at` (the actual §3.4 auto 30-day timer). They are INDEPENDENT (nothing wires one to the
  other) and should stay so — §3.4's control month is a fixed honest baseline, deliberately not billing-tied. So
  **B1 syncs `plan` ONLY; it must NOT touch `ai_guidance_unlock_at`/the control gate.** (The Spawn-during-trial
  facet in Section C is the ONLY intended trial↔gate interaction, and that's a separate deliberate decision.)
- **Effort:** small — one write added to an existing, already-authz'd route.
- **⚠️ Also needs a one-time BACKFILL (or it misses existing customers):** the sync fires on the tier-SET action
  (PATCH), so it only covers FUTURE changes. Any customer already on a paid CRM tier (set before B1 ships) never
  gets a PATCH → their `care_tenant_config.plan` stays `pilot` → **they stay locked on launch day.** So B1 must
  include a one-time backfill: for every account with a currently-paid CRM subscription, apply the same tier→plan
  map to `care_tenant_config.plan`. (If there are zero existing paid customers pre-launch, this is a no-op — but
  confirm, don't assume.) I fold this into the B1 build automatically unless you say there are no existing paids.

### B2. Admin "set plan" toggle
- **Change:** a vendor-admin action/endpoint to set `care_tenant_config.plan` directly.
- **Trade:** manual per-tenant; fine as a stopgap, but you'd forget to flip it.

---

## C. Two facets to handle in the SAME change (whichever options you pick)
1. **Panel "locked" copy:** the fake-flow copy ("start a trial in your workspace") was ALREADY FIXED this session
   (2026-07-23, Finding 3) → it now honestly reads *"Your plan doesn't include the C.A.R.E extension (…). Contact
   your workspace admin to enable it."* (`content.js:262`). So today it's honest, not misleading. When A1/A2 ships,
   update it to the chosen mechanism (A1 → "your trial starts automatically"; A2 → wire the button). Not a blocker
   now — just the final copy pass alongside the write-path.
2. **Spawn during a trial — SHARPER THAN "some suppression" (verified 2026-07-23):** Spawn is §3.4-control-gated,
   and a new company's control window defaults to **30 days** (`companies.ai_guidance_unlock_at default now() +
   interval '30 days'`, migration `0007`). The C.A.R.E trial is **14 days** (`EXTENSION_TRIAL_DAYS`). Since 14 < 30,
   the ENTIRE trial sits inside the control window → **Spawn is 100% suppressed for every trial evaluator, the whole
   trial** — they get 5 of 6 tools and *never* see Spawn work. So the "control-exempt trial tenants for Spawn"
   decision isn't cosmetic: without it, no evaluator can ever try the one tool that writes into their workspace.
   Options: (a) control-exempt Spawn for active-trial tenants; (b) accept it (Spawn is "the paid/graduated tool");
   (c) shorten the control window for trial tenants. Your call — but decide it WITH the write-path, since A1 is what
   creates these month-1 trial tenants. (Verified: `evaluateControlGate` = `manualEnabled || autoUnlocked`; a new
   tenant is neither for 30 days.)

## Recommended combination
**A1 + B1** — auto-start trial on first check (seamless, matches the pitch) + CRM-tier→plan sync (you already set
the tier). Both are small, guarded, reversible builds. Say "A1 + B1" (or any combo) and I implement + test in one
pass, with a migration only if B needs a column (it doesn't — `plan` already exists).
