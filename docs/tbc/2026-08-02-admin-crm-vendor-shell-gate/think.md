---
tbc_version: 1
trigger: fix
started_at: 2026-08-02T03:53:11Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — gate the vendor-CRM shell to match its own API's stated posture

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (build.md). Both in the working tree; the
relevant principles were read this session.

## 2. Why (A26 class sweep, §5 behavioral-verify)
Extending the access-gate class from the sales-coach layout fix, I swept every product-area layout + the
privileged areas. Finding: `/founder/*` (vendor tooling) `notFound()`s non-vendors — but `/dashboard/admin/crm/*`,
which is ALSO vendor-tier tooling (the cross-tenant CRM of all customer accounts), is a **client shell with no
server gate**, living under the company-admin `/dashboard` tree whose parent layout gates only auth+onboarding.
So a mere *company* admin who navigates to `/dashboard/admin/crm` **renders the vendor-CRM shell**.

§5 discipline mattered here: a first grep flagged the admin pages "NO GATE", but that is a catalog-string read.
Behavioral verification of the DATA path showed every CRM route enforces `requireVendorAdmin` (0089) — so there
is **no data leak**; the shell renders empty (API 403s). The real defect is narrower and real: the CRM route's
own comment states the intent *"don't confirm to a customer admin that a vendor CRM exists they can't reach"* —
and the rendering shell **undermines exactly that intent**. The surface contradicts the boundary the code
declares for itself.

Root cause: the vendor-tier existence/shell posture was enforced at the API but never at the page tree, because
the CRM pages are client components and there is no `/dashboard/admin/crm/layout.tsx`.

## 3. Design + interconnection (§1.5 ripple, §3.3 not-overtaking)
Add a server `layout.tsx` at `/dashboard/admin/crm/` that calls the SAME predicate the API uses —
`isVendorAdmin(getCurrentAuthContext(), getVendorCompanyId())` — and `notFound()`s a non-vendor, mirroring
`/founder/files`. Because the predicate is identical to `requireVendorAdmin`'s, **any vendor admin who passes the
API passes the layout** — a real vendor is never locked out. This is NOT a new product decision (§3.3): it
applies the vendor-only boundary the `/founder` area and the CRM API already declare, to the one surface that
was missing it — the same shape as the care layout that "completed the module-access model". Ripple: one new
server layout wrapping the two existing client pages; no route, API, schema, or predicate change.

## 4. Class sweep (A26)
Swept all `/dashboard/admin/*` + `/founder/*` gates behaviorally: founder pages (server, `isVendorAdmin` →
notFound) ✓; admin `asset-readout`/`coach-readout` (`ctx.isAdmin`, coach-readout companyId-scoped) ✓;
`team-check` (`isAdminRole`) ✓; `crm/*` API (`requireVendorAdmin`) ✓. The ONLY gap was the crm PAGE TREE having
no server gate. `asset-readout`/`coach-readout`/`feedback` pages are company-admin-tier client shells whose data
is `isAdmin`-gated (no leak); their missing layout-redirect is a lower-severity UX/defense-in-depth item —
FLAGGED to the founder queue, not fixed here (a multi-page redirect + predicate choice is a design call, §3.3).

## 5. Hypothesis
- **H1:** a vendor admin still reaches `/dashboard/admin/crm` (predicate identical to the API); a non-vendor
  (incl. a company admin) gets `notFound()` server-side (no shell flash); typecheck clean; vendorAuth predicate
  tests still green.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-02T03:53:11Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand why the gap exists before fixing — the shell contradicts the API's declared posture.", "how_this_build_will_embody_it": "Section 2 states the earned root cause (existence posture enforced at API, not the page tree)." },
  { "id": "§0.1", "read_at": "2026-08-02T03:53:11Z", "source_file": "CLAUDE.md", "line_range": "20-40", "why_it_governs": "Methodology in the tree, consulted this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; hashes in build.md." },
  { "id": "§1.5", "read_at": "2026-08-02T03:53:11Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic ripple before a change to an access surface.", "how_this_build_will_embody_it": "Section 3: one server layout, no route/API/schema/predicate change; predicate identical to the API." },
  { "id": "§1.5.1", "read_at": "2026-08-02T03:53:11Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "Feature-workflow continuity — a real vendor admin's flow must be preserved.", "how_this_build_will_embody_it": "Identical-predicate reuse guarantees a vendor who passes the API passes the layout." },
  { "id": "§1.5.2", "read_at": "2026-08-02T03:53:11Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search proactive audit surfaced the gap; then behavioral verify (not grep) sized it.", "how_this_build_will_embody_it": "Section 2 records the catalog-string→behavioral correction." },
  { "id": "§3.3", "read_at": "2026-08-02T03:53:11Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Guide, don't overtake — do not smuggle a NEW product decision into a gate change.", "how_this_build_will_embody_it": "Applies the EXISTING vendor-only boundary (/founder + the CRM API comment); the broader admin-shell redirect is flagged, not built." },
  { "id": "§5", "read_at": "2026-08-02T03:53:11Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Distrust the confident answer — a grep 'NO GATE' would have mis-sized this as a data leak.", "how_this_build_will_embody_it": "Behavioral verify showed the data is API-gated; the fix targets the real (shell-existence) defect." },
  { "id": "§6", "read_at": "2026-08-02T03:53:11Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "Diagnosed, swept, ripple-traced, why-explained; predicate reused not reinvented." },
  { "id": "A19", "read_at": "2026-08-02T03:53:11Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present before citing." },
  { "id": "A22", "read_at": "2026-08-02T03:53:11Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + Session-Reads trailer." },
  { "id": "A26", "read_at": "2026-08-02T03:53:11Z", "source_file": "ThinkerThinker.md", "line_range": "67", "why_it_governs": "A found gap is a CLASS — sweep the siblings.", "how_this_build_will_embody_it": "Section 4 swept all admin + founder gates; only the crm page tree lacked a gate." },
  { "id": "A30", "read_at": "2026-08-02T03:53:11Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "The layout comment states why the shell must match the API's existence posture." },
  { "id": "A38", "read_at": "2026-08-02T03:53:11Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes typecheck + vendorAuth test output." }
]
```
