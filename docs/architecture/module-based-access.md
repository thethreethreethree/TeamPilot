# Module-based access — architecture

> Built 2026-08-01 (founder directive). This is the single reference for how ELOSTATE confines a single-module
> account to its module and gates each product area. Read this before adding a new module or touching auth.

## The model

ELOSTATE ships as three access tiers (the pilot code determines which):

| Tier | What it unlocks | `companies.access_module` |
|---|---|---|
| **Complete** (`elostate`) | Full platform: hub + C.A.R.E + Sales Coach | `null` (no lock — full hub) |
| **Sales Coach** | AI sales-call coaching only | `'sales_coach'` |
| **C.A.R.E** | Customer support AI only | `'care'` |

A single-module account (`access_module` = `care` | `sales_coach`) is **hard-locked**: it lands in its module,
can only reach that module's routes, and is silently redirected home from anywhere else. A Complete/legacy
account (`null`) has full hub access.

## The signal — `companies.access_module` (migration 0207)

The ONE reliable source of an account's lock. Set from the redeemed pilot code by `redeem_pilot_code`
(`care`/`sales_coach` → lock; `elostate` → null). Backfilled for pre-0207 accounts.

**Why a column, NOT the `care_tenant_config` lever:** migration 0045 auto-creates a `care_tenant_config` row
for EVERY company, so "has care" cannot distinguish a C.A.R.E account. The column is the truth, and it's
member-readable via the 0001 `companies` SELECT policy (`id = auth_company_id()`) — `pilot_codes` is RLS-sealed,
so members can't read it there.

## Two enforcement layers (they compose, don't overlap)

1. **Module CONFINEMENT — `src/middleware.ts`.** For an authed user on `/dashboard/*`: one nested query reads
   `companies(access_module)`, and `redirectForLock` (pure, tested — `src/lib/auth/moduleAccess.ts`) sends a
   locked account to its module home if it strays. **Fails OPEN** on a lookup error (never lock a paying user
   out; RLS still protects data). This also handles landing (a locked user on the hub is redirected in).

2. **Product ACCESS gates — per-module layouts.** Independent of the lock: even a Complete account must be a
   *member* of a product area to enter it. Each layout redirects a non-member to `/dashboard`:
   - `sales-coach/layout.tsx` → `sales_coach_role` OR company admin (CEO/COO/admin).
   - `care/layout.tsx` → `deriveCareAccess` = `is_support_agent` OR admin (the SAME predicate every C.A.R.E
     API uses via `requireCareAgent` — reuse it, never inline, so page + API can't drift).

A locked account never reaches another module's access gate (the middleware redirects it first). A care/
sales_coach pilot account is `role='admin'` (from `redeem_pilot_code`), so it passes its own area's gate.

## Scope + a known limitation (adversarial-lens finding, 2026-08-01)

The lock is **page-level, not API-level.** The middleware matcher is `/dashboard/:path*` (+ onboarding/login) —
it does NOT cover `/api/*`. And a single-module pilot account is `role='admin'` (set by `redeem_pilot_code`),
which passes the module-agnostic API gates (`requireCareAgent` = `is_support_agent OR admin`). So a
sales_coach-locked account *could* call `/api/care/*` directly and vice-versa.

**Why this is acceptable as a DATA boundary but flagged as a PRODUCT boundary:**
- Not a data leak: every module API is RLS-scoped to the caller's own company, so a locked account gets only
  its OWN (empty, for the unbought module) data — never another tenant's. RLS, not this lock, is the data
  boundary.
- It IS a billing/product-access softness: a determined admin of a single-module account could *use* an
  unbought module via direct API calls (there's no UI, since the pages are locked). If billing integrity needs
  the lock to be hard at the API layer too, the fix is to add the same `access_module` check to each module's
  API route group (e.g. in `requireCareAgent` / the sales-coach route gate), keyed on the caller's
  `companies.access_module`. That's a founder decision (how strict) + a broader change, not done here.

## Guardrails

- **verify:live invariant #23** — every single-module redeemed company has the matching `access_module`; catches
  a future `redeem_pilot_code` regression that stops stamping it.
- Pure decision core (`moduleAccess.ts`) has 13 unit tests; the RLS read is behaviorally proven (a locked user
  can read `access_module`).

## Adding a new module — the checklist (so the care-gate gap doesn't recur)

1. Add its `access_module` value + the redeem/provisioning path.
2. Add its landing route to `MODULE_LANDING` (`src/lib/nav/landing.ts`) and `moduleForPath` + `moduleHome`
   (`moduleAccess.ts`).
3. Add a **layout access gate** reusing a shared, tested predicate (mirror `care/layout.tsx`). A product area
   with no page gate shows non-members a broken shell — always gate it.
4. Extend the verify:live invariant if the provisioning path changes.
