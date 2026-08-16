# CLOSURE — founder session-monitoring (0214 exemption)

## What shipped
A sanctioned, contained cross-tenant monitoring capability for the two vendor founders: an
existing-companies allowlist + audit log (migration 0214), a service-role data layer funneled through
one allowlist gate, three `requireVendorAdmin`-gated + audited APIs, and a drill-down UI. Customer RLS
untouched; new customers excluded until deliberately added.

## Verification (A38) — canonical command + exit code
```
$ npm run check
  ✓ No theme-bound leaks.
  ═══ RLS policy audit ═══   Tables without RLS: 0 · Tenant-pin risks: 0 · Missing policies: 0
  ═══ Invariant audit ═══   Files scanned: 793 · Violations: 0
  ✓ tbc:docs · tbc:manifest (15) · tbc:artifacts · tbc:residual · tbc:freshness
  Test Files  426 passed | 1 skipped (427)
  Tests       2933 passed | 15 skipped (2948)
GATE_EXIT=0
```

## DB apply (the one irreversible prod step, founder-approved)
```
$ npm run db:dry
  1 pending migration(s): 0214_vendor_monitoring_scope.sql   DRY_EXIT=0
$ npm run db:apply
  0214_vendor_monitoring_scope.sql applied.
  verify:live — ✅ ALL 26 invariants hold (tenant isolation still behaviorally enforced post-apply).
DB_APPLY_EXIT=0
```
The allowlist (`vendor_monitoring_scope`) was seeded from the companies existing at apply time; new
companies created hereafter are NOT auto-added (the founder's "existing only" constraint, structural).

## Residual (A36)
```json
[
  { "id": "R1", "item": "The monitored REPS did not individually consent; only the company owner requested monitoring, and the founder directed access to ALL existing companies (not only the requesting one).", "why_skipped": "Founder decision as equal platform owner; the concern was surfaced via the decision picker and overridden deliberately. The audit log makes every access accountable; rep-level notice is a product decision the founder owns.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-16T07:40:00Z", "outcome": "Accepted on founder authority — flagged here so it is on the record, not silent. §3.4 tension noted." },
  { "id": "R2", "item": "This is a genuine tenant-isolation exemption; if is_vendor_super_admin() or requireVendorAdmin ever regresses, the blast radius is the allowlisted companies' coaching data.", "why_skipped": "Contained to one vendor surface (not customer RLS), audited, and both predicates are hardened (0089) + tested; the containment limits blast radius vs. an RLS-wide open.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-16T07:40:30Z", "outcome": "Accepted — containment + audit are the mitigations; rls:audit continues to guard the customer policies." },
  { "id": "R3", "item": "No cap/pagination on listCompanySessions (limit 200) or transcript size.", "why_skipped": "Admin oversight tool for the founders only; 200 newest is sufficient for monitoring and bounded. Not a customer-facing surface.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-16T07:41:00Z", "outcome": "Noted — revisit if a monitored company exceeds 200 sessions in the window." }
]
```

## Un-named reliance
- Relies on `is_vendor_super_admin()` / `requireVendorAdmin` resolving to EXACTLY the two founders (admins of
  the vendor company). If a third person were made an admin of the vendor company, they too would gain
  monitoring access — the boundary is "vendor-company admin", not a hardcoded two-account list.
- Relies on `SUPABASE_SERVICE_ROLE_KEY` being present server-side (the data layer throws without it) — the
  reads fail loudly, not silently, if it is missing.
- Relies on the migration having been applied (the tables exist) — surfaced as the DB-apply step above, not assumed.
