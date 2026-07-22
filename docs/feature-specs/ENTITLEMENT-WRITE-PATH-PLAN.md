# Entitlement write-path — implementation plan (the #1 launch blocker)

The extension is `locked` for every tenant because nothing writes `care_tenant_config.plan=pro/enterprise` or
`extension_trial_started_at` (re-verified 2026-07-23: neither is written by any flow; `plan` defaults to `pilot`
forever). Two write-paths must exist. This is the exact plan for each option so that once you pick, I execute
immediately — and the gotchas below should inform the pick.

The read side is DONE and tested: `computeExtensionEntitlement` (pure, 16 tests incl. trial-window boundaries +
case-insensitivity) unlocks on `plan∈{pro,enterprise}` OR `extension_trial_started_at` within 14 days. Only the
WRITE side is missing.

---

## A. Trial start — pick ONE

### A1. Auto-start on first entitlement check *(recommended — matches the pitch)*
- **Change:** in `getExtensionEntitlement(companyId)` (`src/lib/care/extensionEntitlement.ts`), after the read,
  if the tenant is non-paid AND `extension_trial_started_at` is null → `UPSERT care_tenant_config` set
  `extension_trial_started_at = now()`, then treat the trial as started for this response.
- **Gotchas (decide-relevant):** (1) must be an UPSERT — a tenant may have no `care_tenant_config` row yet
  (bootstrap trigger inserts one, but not guaranteed for every path); (2) idempotent — write only when null, never
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
- **Gotcha:** map CRM tier names → the `plan` enum (`pilot|starter|pro|enterprise`); downgrade path too (tier
  drops → plan drops). Vendor-admin-only (the route already gates on `requireVendorAdmin`).
- **Effort:** small — one write added to an existing, already-authz'd route.

### B2. Admin "set plan" toggle
- **Change:** a vendor-admin action/endpoint to set `care_tenant_config.plan` directly.
- **Trade:** manual per-tenant; fine as a stopgap, but you'd forget to flip it.

---

## C. Two facets to handle in the SAME change (whichever options you pick)
1. **Panel "locked" copy:** today it says "start a trial in your workspace" — a flow that doesn't exist. Update it
   to match the chosen mechanism (A1 → "your trial starts automatically"; A2 → wire the button; etc.).
2. **Spawn during a trial:** Spawn is §3.4-control-gated, so a brand-new trial tenant (month-1 control window)
   gets Spawn suppressed while the other 5 tools work. Decide whether trial tenants should be control-exempt for
   Spawn so evaluators can try all six tools. (Second-order — only bites once trials actually start.)

## Recommended combination
**A1 + B1** — auto-start trial on first check (seamless, matches the pitch) + CRM-tier→plan sync (you already set
the tier). Both are small, guarded, reversible builds. Say "A1 + B1" (or any combo) and I implement + test in one
pass, with a migration only if B needs a column (it doesn't — `plan` already exists).
