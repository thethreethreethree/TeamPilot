-- 0189 — C.A.R.E browser-extension entitlement (founder 2026-07-22).
--
-- SPEC: docs/feature-specs/CARE-BROWSER-EXTENSION.md, decision D2. The extension is unlocked when the tenant
-- is on `pro`/`enterprise` (the existing `care_tenant_config.plan`) OR within an active limited free trial.
-- The trial is time-boxed (EXTENSION_TRIAL_DAYS, default 14) from the start timestamp this migration adds, and
-- account-gated (the auth layer requires a logged-in tenant; there is no anonymous use).
--
-- ADDITIVE ONLY — one new nullable column. It changes NO existing column, read, write, policy, or trigger.
-- Every existing C.A.R.E query keeps working byte-for-byte. The entitlement code
-- (src/lib/care/extensionEntitlement.ts) reads this column and degrades gracefully via isMissingColumnError
-- until this migration is applied — so code and schema can land in either order without an outage
-- (the migration-coupling discipline). Until applied, `getExtensionEntitlement` falls back to a plan-only
-- read: pro/enterprise = active, everyone else = locked (no trial). Applying this file enables the trial.

alter table care_tenant_config
  add column if not exists extension_trial_started_at timestamptz;  -- null = no trial started

comment on column care_tenant_config.extension_trial_started_at is
  'C.A.R.E extension: when this tenant''s free trial began. NULL = no trial. Trial is active for '
  'EXTENSION_TRIAL_DAYS from this timestamp (see src/lib/care/extensionEntitlement.ts). Non-paid tenants '
  'without an active trial are locked out of the extension (server-enforced).';
