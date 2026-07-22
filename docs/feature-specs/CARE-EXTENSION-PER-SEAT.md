# Spec — Per-seat entitlement for the C.A.R.E extension (pricing prerequisite)

Status: **PROPOSAL — awaiting founder decision.** Not built. Written 2026-07-22 to make the "$24/agent/month"
pricing actionable. The recommended pricing (per-agent) cannot be billed or enforced on the current architecture;
this spec scopes exactly what closes that gap and the decisions only the founder can make.

## Why this exists
The pricing recommendation is **per-agent** ($24/seat/mo + a free wedge tier). But today the extension is
entitled **per-tenant**, so "per-agent" is unbillable and unenforceable as-is. Either the pricing changes to
per-tenant, or this work happens. This spec assumes per-agent is the goal.

## Current state (from the code, exactly)
- **Entitlement is tenant-level.** `getExtensionEntitlement(companyId)` reads `care_tenant_config` (`plan`,
  `extension_trial_started_at`) and returns `active | trial | locked` for the WHOLE tenant
  (`src/lib/care/extensionEntitlement.ts`). `computeExtensionEntitlement` is pure + unit-tested.
- **Auth is agent-agnostic.** `requireEntitledExtensionUser` (`src/lib/api/extensionAuth.ts`) validates the
  Bearer token → resolves `{ userId, companyId }`, confirms the user is an ACTIVE member of the tenant, then
  checks the *tenant's* entitlement. Any active member of an entitled tenant gets full access. There is no seat.
- Consequence: 3 agents or 300, one `pro` plan unlocks them all. Fine for a tenant-wide license; incompatible
  with per-seat billing.

## What per-seat requires (four layers, AMD-006 order)

**1 — Structure (data).** A seat record per (company, agent):
- `care_extension_seats(company_id, agent_id, assigned_at, assigned_by, status active|revoked)` — append-friendly
  (revoke = status change, keep history per §3.1 spirit).
- Tenant seat allowance: add `extension_seats_purchased int` to `care_tenant_config`.
- Invariant to enforce (DB): `count(active seats) <= extension_seats_purchased`.

**2 — Effectivity (the gate).** `requireEntitledExtensionUser` gains a per-agent check: tenant entitled AND this
`agent_id` holds an ACTIVE seat (or the tenant is in trial → trial grants all members, the wedge). One new query;
the pure `computeExtensionEntitlement` stays, wrapped by a seat check. Fail-closed on no seat (402, same as today's
unentitled path — already tested).

**3 — Composition (workflow).** Seat assignment UI in the C.A.R.E settings (admin only): a roster with assign/
revoke toggles, "X of N seats used", and a block when full. Reuses the existing `isCompanyAdminRole` gate + the
agents list already in `care/settings/agents`.

**4 — Surface/billing (the real unknown).** Seat count → billing. **This is the piece I can't scope without you**
— I don't know the billing integration (Stripe? manual? none yet). Options: (a) manual — you set
`extension_seats_purchased`, invoice offline; (b) Stripe seat-quantity subscription synced to the count. (a) ships
this week; (b) is a real integration project.

## Decisions only you can make
1. **Per-agent vs per-tenant pricing?** If you'd rather price per-tenant (flat $X/company for unlimited agents),
   NONE of this is needed — the current model already supports it, and it's simpler to sell. Per-seat earns more
   at scale but needs this build. *This is the fork.*
2. **What is a "seat"** — any agent who installs, or explicitly-assigned agents only? (Assigned is cleaner + caps
   COGS; install-based is lower-friction but uncapped.)
3. **Billing path** — manual seat count now, Stripe sync later? Or block on Stripe?
4. **Trial** — keep the tenant-wide 14-day trial as the free wedge (recommended — it's the adoption driver), then
   convert to N assigned seats at purchase.

## Effort (rough, once decisions are made)
- Layers 1–3 (data + gate + assignment UI), manual billing: **~1 focused build session**, fully testable
  (the gate is a pure-function wrap; the invariant is a DB constraint; the UI reuses existing admin patterns).
- Layer 4 Stripe sync: **separate**, sized by your billing stack (unknown to me).

## Recommendation
If per-agent pricing is the goal, do **layers 1–3 with a manual seat count first** — it makes per-seat real and
sellable immediately, defers the Stripe integration, and keeps the tenant-wide trial as the free wedge. Say the
word and I'll build layers 1–3; the Stripe decision can come after you see seat enforcement working.
