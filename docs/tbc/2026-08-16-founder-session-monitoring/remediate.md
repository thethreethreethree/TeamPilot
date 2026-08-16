# REMEDIATE — founder session-monitoring

## During-build decisions
- **Chose service-role containment over RLS-weakening.** The first instinct — add
  `or is_vendor_super_admin()` to every coaching SELECT policy — would have put a cross-tenant
  clause in the CUSTOMER model, where a regression in one predicate silently opens every tenant.
  Rejected it; kept customer RLS untouched and contained all cross-tenant reads to one vendor-side
  service-role surface with an allowlist + audit. Narrowest accountable shape (§2).
- **Surfaced the concerns before building, not after.** Consent scope, §3.4 anti-surveillance, and
  the tenant-isolation model were put to the founder via the decision picker. The founder decided
  and declared the exemption; the build then executed it — guide-don't-overtake, objection-as-data.

## Adjacent surfaces checked (§1.5.2)
- Customer coaching routes — untouched; the 2026-08-15 IDOR guards + RLS remain in force.
- CRM vendor surface — the gate/pattern this mirrors (requireVendorAdmin, notFound() shell, service-role).
- Invariant audit — passes 0 violations; the new admin routes satisfy "every admin route gated".

## Residual / follow-ups
- The DB migration is an external-to-code precondition until applied (§1.5.3) — handled this session via
  `npm run db:apply` (founder-approved), verified in closure.md; if it were deferred it would be a blocking
  setup step.
- No per-read consent from the monitored REPS (only the company owner requested it). Recorded as a residual
  in closure.md — the audit log makes access accountable, but rep-level notice is a product decision the
  founder owns.
- No mutation/coaching-injection surface added — monitoring is read-only by construction.
