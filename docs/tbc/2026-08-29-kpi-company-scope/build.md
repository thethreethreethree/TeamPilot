# BUILD — company-aggregate KPI scope

### The scoped route (reuse the compute over pooled rows)
- write-path: `kpi/me/route.ts` — `GET(req)` reads `scope`; `scope=company` + `ctx.isAdmin` pools the company's
  sales-coach members (`.in("agent_id", memberIds)`) for BOTH the sessions and the after-pitch reads; else self.
  Non-admin `scope=company` silently falls back to self (no leak). Returns `scope`. Every metric function unchanged.
- read-path: an admin's `/kpi/me?scope=company` returns Conversion/Close/Win-loss computed across the whole
  business — real numbers (verified 40.9% conversion for the top company) instead of a sparse per-rep "building".

### The page toggle
- write-path: `kpi/page.tsx` — a manager (the `/kpi/team` fetch returned 200) defaults `scope` to `company`; a
  Company/Mine segmented toggle switches it; `loadMe` carries `?scope=`.
- read-path: an owner lands on the business's numbers by default and can flip to their own; a non-manager never
  sees the toggle and only ever gets self.

## Files
- `src/app/api/coach/kpi/me/route.ts` — scope param + admin-gated company pooling
- `src/app/dashboard/sales-coach/kpi/page.tsx` — scope state, default-to-company for managers, Company/Mine toggle

## Ripple (§6 item 5)
- No new compute + no gate change: the same functions run over a different row set (§1.5.2 reuse). RLS same-company
  read is the existing policy the team route already relies on. Revenue/avg-deal stay honestly "building" (zero
  sold-with-value); the outcome prompt shipped this session captures the deal value that fills them.
