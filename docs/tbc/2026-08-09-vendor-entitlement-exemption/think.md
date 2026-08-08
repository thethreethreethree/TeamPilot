---
tbc_version: 1
trigger: fix
started_at: 2026-08-09T08:40:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 1
---

# THINK — vendor/home-tenant exemption for extension entitlement (founder-reported block)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in tree, hashes unchanged since the xl build. Cited
axioms RE-READ FRESH this build (08:45–08:55Z, post-dating started_at per A22): A33 (850-864), A38 (999-1018),
A30 (768-775), plus the CLAUDE.md §§ carried in-session. Not cited from cache.

## 2. The report (founder, 2026-08-09)
The founder, testing the Sales Coach extension on their OWN account, got: *"Your 14-day Sales Coach extension
trial has ended."* Their words: *"the system doesn't understand I'm the founder."* (Capture itself worked — 692
chars with the preview snippet from the 67d80fb9 fix — so this is purely the entitlement gate.)

## 3. Diagnosis (§0 / §1.2 — understand from the record before patching)
Traced the gate end-to-end, not theorized:
- `requireEntitledExtensionUser` (`src/lib/api/extensionAuth.ts:74`) → `getExtensionEntitlement(companyId)` → on
  `locked`, returns a 402 whose message is `Your 14-day <product> trial has ended.` when `entitlement.trialEnded`.
- `getExtensionEntitlement` (`extensionEntitlement.ts`) decides purely from `care_tenant_config.plan` +
  `extension_trial_started_at`: paid → active; unexpired trial → trial; expired trial → locked+trialEnded.
- **There is NO vendor/founder exemption anywhere.** The system has no notion of "us" — it only knows the
  customer plan/trial. The founder's dogfooding tenant carries an expired pilot-trial artifact → `locked` +
  `trialEnded` → the founder is paywalled off the product they build. This is a MISSING feature, not a broken
  one (§0: articulate WHY it exists — entitlement was authored customer-only, no home-tenant carve-out).

## 4. Is the founder in the vendor tenant? VERIFIED (don't ship a fix that doesn't unblock them)
The fix works only if the founder's `companyId` equals the home id. Confirmed from the record:
- migration `0089_harden_vendor_super_admin_company_scope.sql:46` DEFINES vendor-super-admin as the profile's
  `company_id = c3e7f389…` (the ELOSTATE company).
- `scripts/create-tester-accounts.mjs` treats `johnsyramos@gmail.com` as "the existing owner" of that company.
- The founder already uses vendor-admin features (`/founder/files` via `requireVendorAdmin`), which gate on
  `getVendorCompanyId()` = `CARE_DEFAULT_TENANT_ID ?? c3e7f389`. **My fix uses the IDENTICAL resolver**
  (`getOwnTenantId`, care/config.ts) → if vendor-admin works for the founder (it does), this exemption resolves
  to the founder's company by construction.

## 5. The fix — exempt the home tenant at the entitlement CHOKEPOINT (A33)
`getExtensionEntitlement` is the single chokepoint every extension entitlement decision passes through (ripple:
its ONLY caller is `extensionAuth.ts`, serving BOTH the C.A.R.E and Sales Coach extensions). Add, BEFORE the
config read (so it's pure/DB-free and the vendor is active regardless of the plan/trial artifact):
```ts
if (companyId === getOwnTenantId()) return { status: "active", trialDaysLeft: 0, plan: "vendor", trialEnded: false };
```
Exempt by IDENTITY, not by mutating the tenant's plan data (a data edit would be narrow, non-durable, and would
conflate "founder" with "this row is enterprise"). Customers are unaffected — a customer tenant never equals the
home id (blast-radius guard test).

## 6. Gate or promise (A30 / A33) — GATED cleanly
Unlike the double-write class (a semantic call-graph property → declined per A33), this invariant IS precisely
detectable at the chokepoint: "the home tenant is always active; a non-home tenant is not exempted." Encoded as
two detection-true tests in `extensionEntitlement.test.ts` (home id + expired trial → active; customer id +
expired trial → locked). A30 satisfied: the class fails without the author's cooperation.

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-09T08:45:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand WHY the block exists before patching — entitlement was authored customer-only.", "how_this_build_will_embody_it": "Section 3 traces the gate end-to-end and names the missing carve-out." },
  { "id": "§0.1", "read_at": "2026-08-09T08:45:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition for a substantive build.", "how_this_build_will_embody_it": "Section 1 records docs present + fresh axiom reads." },
  { "id": "§1.2", "read_at": "2026-08-09T08:46:00Z", "source_file": "CLAUDE.md", "line_range": "178-182", "why_it_governs": "Retrospective identification — diagnose from the actual record (migrations, scripts, the gate code), not by theorizing.", "how_this_build_will_embody_it": "Sections 3-4 identify the root cause and confirm the founder's tenant from 0089 + the owner script." },
  { "id": "§1.5", "read_at": "2026-08-09T08:46:00Z", "source_file": "CLAUDE.md", "line_range": "125-129", "why_it_governs": "Holistic — trace what else the change affects before committing.", "how_this_build_will_embody_it": "Ripple in build.md/Section 5: one caller, both extensions, no other plan-value consumer." },
  { "id": "§1.5.1", "read_at": "2026-08-09T08:46:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer 2 operational-effectivity — does the feature work end-to-end for the real caller (the founder)?", "how_this_build_will_embody_it": "Section 4 verifies the founder's company matches the resolver so the fix actually unblocks them." },
  { "id": "§1.5.2", "read_at": "2026-08-09T08:46:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Trace adjacent surfaces — the exemption must cover both extensions and not blanket-unlock customers.", "how_this_build_will_embody_it": "Ripple (Section 5) confirms one caller, both extensions; blast-radius test guards customers." },
  { "id": "§3.4", "read_at": "2026-08-09T08:47:00Z", "source_file": "CLAUDE.md", "line_range": "282-295", "why_it_governs": "Honest states — the exemption must not become a silent blanket grant; only the home tenant, by identity.", "how_this_build_will_embody_it": "Exemption keys on the home id ONLY; customers still get honest locked/trial states." },
  { "id": "§5", "read_at": "2026-08-09T08:52:00Z", "source_file": "CLAUDE.md", "line_range": "334-348", "why_it_governs": "Builder-under-pressure — don't pre-build a speculative per-user allowlist to look thorough; ship the real fix.", "how_this_build_will_embody_it": "R2 residual declines the per-user allowlist as scope-creep with no current trigger." },
  { "id": "§6", "read_at": "2026-08-09T08:47:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist — diagnosed from record, ripple-traced, gate-or-promise answered.", "how_this_build_will_embody_it": "Sections 3-6 answer each item." },
  { "id": "A19", "read_at": "2026-08-09T08:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted in-tree this build, not cached.", "how_this_build_will_embody_it": "Docs verified present + axioms re-read (Section 1)." },
  { "id": "A22", "read_at": "2026-08-09T08:48:00Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reading with real timestamps.", "how_this_build_will_embody_it": "This manifest reflects reads done 08:45-08:55Z, post-dating started_at." },
  { "id": "A30", "read_at": "2026-08-09T08:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "A fix isn't done until the class is encoded in a gate.", "how_this_build_will_embody_it": "Two detection-true entitlement tests encode the exemption + its blast-radius bound." },
  { "id": "A33", "read_at": "2026-08-09T08:52:00Z", "source_file": "ThinkerThinker.md", "line_range": "850-864", "why_it_governs": "A gate must be precise or relocate to the chokepoint.", "how_this_build_will_embody_it": "The invariant IS precise at the getExtensionEntitlement chokepoint, so it's gated (not declined)." },
  { "id": "A38", "read_at": "2026-08-09T08:54:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command by name + pasted output.", "how_this_build_will_embody_it": "check.md pastes `npm run check` with its exit code." }
]
```
