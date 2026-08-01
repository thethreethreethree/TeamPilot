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
  unbought module via direct API calls (there's no UI, since the pages are locked). The softness is
  **symmetric**: a sales_coach account passes the care gate (`requireCareAgent` = `is_support_agent OR admin`,
  and it's `role='admin'`), AND a care account passes the sales-coach manager gate (`isSalesCoachManager` =
  `sales_coach_role='admin' OR role in CEO/COO/admin`, and it's `role='admin'`).
- **Effort if you want it hard at the API layer (scoped 2026-08-01):** it's NOT a clean 2-chokepoint fix.
  C.A.R.E has one gate (`requireCareAgent`) → one edit. But Sales Coach APIs gate at MULTIPLE points: manager
  routes use `isSalesCoachManager`, while rep routes use `getCurrentAuthContext` (ANY authed user, no role
  check) — so a per-route/per-gate `access_module` check is needed, with real risk of missing a route or
  breaking a legitimate one. That's why this stays a founder decision (`"lock the module APIs too"`), not a
  self-authorized change: today's page-level lock is sufficient for DATA security (RLS), and the API hardening
  is a genuine build with a strictness trade-off only the founder should set.

## Guardrails

- **verify:live invariant #23** — every single-module redeemed company has the matching `access_module`; catches
  a future `redeem_pilot_code` regression that stops stamping it.
- Pure decision core (`moduleAccess.ts`) has 13 unit tests; the RLS read is behaviorally proven (a locked user
  can read `access_module`).

### Source-spec compliance (verified 2026-08-01 against `PILOT-ACCESS-CODES.pdf`)

The three tiers here are the same ones on the confidential codes handout, and the account-creation system was
cross-checked against that source PDF end-to-end — all compliant:

| PDF promise | Where it holds |
|---|---|
| Unambiguous alphabet (no `0/O/1/I/L`) | `PILOT_CODE_ALPHABET` (`src/lib/pilot/generateCode.ts`) = `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; guarded by `generateCode.test.ts` (asserts the 5 glyphs are excluded — a future edit re-adding one fails CI, not a client's support ticket) |
| 7-char, single-use, case-insensitive redeem | `PILOT_CODE_LENGTH=7`; `redeem_pilot_code` row-lock single-use; `upper(trim(code))` lookup (0197) |
| Each code provisions "that code's module" | `pilot_codes.module ∈ (elostate, care, sales_coach)` → 0207 stamps `companies.access_module` → this lock confines |

The 100 live codes are NOT in the repo (confidential; generated + inserted out-of-band via
`scripts/pilot-generate.mjs`, which draws from the same guarded alphabet). 0197's header still describes the
original *soft* land-in-module decision — that's a correct append-only historical record; 0207's header
documents superseding it with this hard lock, and this doc is the current-state source of truth.

## Adding a new module — the checklist (so the care-gate gap doesn't recur)

1. Add its `access_module` value + the redeem/provisioning path.
2. Add its landing route to `MODULE_LANDING` (`src/lib/nav/landing.ts`) and `moduleForPath` + `moduleHome`
   (`moduleAccess.ts`).
3. Add a **layout access gate** reusing a shared, tested predicate (mirror `care/layout.tsx`). A product area
   with no page gate shows non-members a broken shell — always gate it.
4. Extend the verify:live invariant if the provisioning path changes.
