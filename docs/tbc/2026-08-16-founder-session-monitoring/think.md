---
tbc_version: 1
trigger: feature
started_at: 2026-08-16T07:00:00Z
doc_hashes:
  CLAUDE.md: 3325eedc1e905b2798d196dae087664e3da7031a66005b1f89379b6da959a9e3
  ThinkerThinker.md: 19d6ff103082c1f29ee98653b84cce2a26308352511756f6e104a8db36df84c9
manifest_entries: 15
hypotheses: 1
---

# THINK — founder session-monitoring (sanctioned cross-tenant exemption)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (3325eedc…) + ThinkerThinker.md (19d6ff10…) in-tree; hashes equal the current
DOC_MANIFEST.json. No constitutional amendment — this is a founder-directed operational
exemption recorded in the build, not a change to the constitution's text.

## 2. Why (founder-directed, from the record §1.2)
The two vendor founders (John + Moses, equal owners) directed, at a customer owner's personal
request, that THEY be able to monitor sessions across the companies that ALREADY exist in the
system — and explicitly NOT gain automatic access to future customers. I surfaced the concerns
(consent scope, the §3.4 anti-surveillance thesis, the tenant-isolation model the 2026-08-15
peer-rep IDOR fix hardened) via the decision picker; the founder heard them, declared it a
sanctioned exemption, and directed the build ("just do it", "this is an exemption").

## 3. The exemption, and the discipline that keeps it safe
This is a deliberate cross-tenant read capability. Per §2 (interrogate locked doors) the
isolation is a REAL constraint, so the exemption is built to the narrowest, most accountable
shape rather than by weakening the shared model:

1. **Customer RLS untouched.** coaching_sessions/_segments/_cues/after_pitch SELECT policies stay
   exactly as 0083/0084 left them. ALL cross-tenant access is contained to one vendor-side,
   service-role surface (`/api/admin/monitoring/*`) behind `requireVendorAdmin`.
2. **Allowlist = existing companies only.** `vendor_monitoring_scope` seeded from companies that
   exist at apply time; NO trigger adds new ones. A future customer is not monitorable until a
   founder adds them deliberately — the founder's explicit constraint, encoded structurally.
3. **Audited.** Every read writes `vendor_monitoring_access_log` (actor, company, session).
4. **Who = is_vendor_super_admin() / requireVendorAdmin** (admin of the vendor company, hardened
   0089) — exactly the two founders. No new role, no membership in customer companies.
5. **Read-only + honest surface (§3.4).** Monitoring never mutates a session, and the UI states
   plainly that access is recorded — oversight, not a hidden backdoor.

## 4. Interconnections traced (§1.5)
- New tables are vendor-super-admin gated (mirror crm_* / 0089); no customer can read or forge them.
- New routes gate on `requireVendorAdmin` (recognised by the invariant audit's "every admin route
  gated" + "non-public mutation route references a recognised gate") — audit passes with 0 violations.
- Service-role reads bypass RLS by design; the allowlist + vendor gate + audit are the substitute
  controls, contained to this surface (not a hole in the customer model).

## 5. Hypothesis (§1.5.2)
H1: a vendor-only, allowlist-scoped, audited service-role surface delivers the founders' monitoring
need WITHOUT weakening any customer's RLS and WITHOUT auto-including future tenants — verified by
the route tests (gate → allowlist-404 → audit-on-success) and the seed-from-existing-only migration.

## Session-read manifest (A22 / A35)

```json
[
  { "id": "§0", "read_at": "2026-08-16T07:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understanding precedes solving — understand the tenant-isolation model before opening a hole in it.", "how_this_build_will_embody_it": "Built as a contained exemption, not a blanket RLS weakening, after tracing the model." },
  { "id": "§0.1", "read_at": "2026-08-16T07:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified equal to DOC_MANIFEST; no amendment." },
  { "id": "§1.5.1", "read_at": "2026-08-16T07:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer — structure (contained surface) before UI; does it actually work end-to-end.", "how_this_build_will_embody_it": "Data layer + gated routes + tests + a usable UI + the DB precondition surfaced." },
  { "id": "§1.5.2", "read_at": "2026-08-16T07:01:20Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — the safe shape (contained/allowlisted/audited) vs the unsafe (blanket RLS open).", "how_this_build_will_embody_it": "Rejected RLS-weakening; chose the vendor-side contained surface." },
  { "id": "§2", "read_at": "2026-08-16T07:01:35Z", "source_file": "CLAUDE.md", "line_range": "220-245", "why_it_governs": "Interrogate locked doors — respect a real constraint, find the better destination.", "how_this_build_will_embody_it": "Isolation kept intact; the exemption is the narrowest accountable path, not a picked lock." },
  { "id": "§3.4", "read_at": "2026-08-16T07:01:50Z", "source_file": "CLAUDE.md", "line_range": "330-345", "why_it_governs": "Honesty / no surveillance — monitoring must be accountable, not hidden.", "how_this_build_will_embody_it": "Read-only, audited, and the UI states access is recorded." },
  { "id": "§6", "read_at": "2026-08-16T07:02:05Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Decision checklist — real vs incidental constraint, holistic ripple.", "how_this_build_will_embody_it": "Ripple traced (tables, routes, invariant audit); constraint honored via allowlist." },
  { "id": "A19", "read_at": "2026-08-16T07:02:20Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read vendorAuth, is_vendor_super_admin (0089), the CRM service-role pattern, coaching RLS before building." },
  { "id": "A22", "read_at": "2026-08-16T07:02:35Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Every cited asset was opened this session." },
  { "id": "A30", "read_at": "2026-08-16T07:02:50Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the guarantee in a gate.", "how_this_build_will_embody_it": "Route tests pin gate → allowlist-404 → audit-on-success; the seed encodes existing-only." },
  { "id": "A38", "read_at": "2026-08-16T07:03:05Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "check.md + closure.md paste the gate + db:apply output and exit codes." },
  { "id": "§1.2", "read_at": "2026-08-16T07:03:20Z", "source_file": "CLAUDE.md", "line_range": "200-210", "why_it_governs": "Retrospective — the exemption is built from the record of what the founder directed and the concerns raised.", "how_this_build_will_embody_it": "Section 2 diagnoses the ask + the surfaced concerns before the build." },
  { "id": "§1.5", "read_at": "2026-08-16T07:03:35Z", "source_file": "CLAUDE.md", "line_range": "78-100", "why_it_governs": "Holistic — trace what the exemption touches (RLS audit, invariant audit, customer isolation).", "how_this_build_will_embody_it": "Section 4 enumerates the ripple; customer RLS left untouched." },
  { "id": "§1.5.3", "read_at": "2026-08-16T07:03:50Z", "source_file": "CLAUDE.md", "line_range": "174-200", "why_it_governs": "External-config completeness — the migration is a config precondition outside the code.", "how_this_build_will_embody_it": "The DB apply is run + verified this session (not assumed); flagged as the precondition in remediate/closure." },
  { "id": "§2.2", "read_at": "2026-08-16T07:04:05Z", "source_file": "CLAUDE.md", "line_range": "250-275", "why_it_governs": "Single-source decisions — the allowlist is the ONE authority for 'is this company monitorable', consumed as a verdict.", "how_this_build_will_embody_it": "isCompanyMonitorable is the single gate; routes consume it, never re-derive the scope." }
]
```
