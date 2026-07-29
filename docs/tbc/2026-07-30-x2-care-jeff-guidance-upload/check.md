# CHECK — C.A.R.E doc upload + Jeff guidance audit

Audited the built files from the outside-view stance.

## Within-module pass (four layers)

- **1 structure:** reuses extractText + DocUploadButton + the existing care config-save guard (A28); one
  new column, one prompt block, one route. No new pattern.
- **2 effectivity:** typecheck 0; careGuidancePrompt 3/3; care extract route 4/4; widgetSafe 3/3 (confirms
  the new field does NOT leak to the public widget). Full `npm run check` in closure.md.
- **3 composition:** the guidance editor sits with Knowledge + product-context on the same page; upload
  fills each draft → existing save. No existing care surface disturbed.
- **4 surface:** a guidance panel + an "Upload a file" control on each surface; honest "trimmed to fit" +
  migration-pending toasts.

## Cross-module pass

- **Trust boundary (checked):** the guidance is ADMIN config, injected as directives like productContext —
  NOT customer-supplied — so it is NOT fenced like the ACMS knowledge (which stays fenced as untrusted
  data). The block is scoped "within your core identity and honesty rules", so a tenant's guidance shapes
  HOW Jeff helps but cannot make him pretend to be human or invent facts. Confirmed by reading the
  identity block ordering (identity first) + the scoping clause.
- **A34 seam:** config select(*) omits the absent column; the save guard drops it + retries. A pre-0202
  save of OTHER settings is unaffected; only a guidance save pre-migration returns the deferred flag.
- **No widget leak:** the widgetSafe test constructs a config with a SECRET guidance sentinel and asserts
  it does not appear in the public widget config (the field is internal/admin-only).

## Class sweep (A26)

- class: a new prompt-feeding field that saves but never reaches the LLM (dead surface). sweep: `grep -rn
  "buildCareSystemPrompt(" src/app/api/care` → 3 callers; the 2 REAL tenant callers (widget messages,
  inbound email) now pass aiAssistanceGuidance; the demo caller uses ELOSTATE's fixed context (no tenant
  guidance) by design. So the field reaches every real reply path.
- class: a new function-body upload route without validation. sweep: the care extract route validates by
  extension-allowlist + 4MB + per-field cap, never stores, and is in the invariant-audit allowlist with
  its reason (mirrors the sales-coach route).

## Findings

No findings. Additive; admin-gated; A34-guarded; tsc-clean; unit-pinned. (remediate.md omitted.)

## Inspected / not-inspected

- **Inspected:** the migration, config type+mapper, the prompt block + both callers, the tenant-route save
  + A34 guard, the care extract route (auth+format), DocUploadButton props, all three UI wirings, tsc +
  the full check.
- **NOT inspected (→ residual):** live behavior against an APPLIED 0202 (migration not applied by me); the
  live browser upload on each C.A.R.E surface; whether an 8k guidance cap is right vs a company's real
  guidance length (a product judgment).
