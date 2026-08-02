---
tbc_version: 1
trigger: refactor
started_at: 2026-08-02T03:43:22Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — extract the Sales-Coach area access gate to a pure, tested predicate

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (sha256sum in build.md). Both present in
the working tree; the relevant principles were read this session.

## 2. Why (§1.5.2 proactive audit, §5 distrust-the-fast-answer)
A proactive audit of the module-access surface compared the two product layouts. The `/dashboard/care` gate
routes through the shared, tested pure predicate `deriveCareAccess` — and `skillAccess.ts` states the doctrine
explicitly for its manager gate: *"the ACCESS gate is the first defense … Extracted pure + tested so a future
weakening … fails CI, not just review."* The `/dashboard/sales-coach` layout, by contrast, **inlined** its
access predicate (`isCompanyAdmin || hasSalesCoachRole`) and had **no regression test**. So a security
access-gate sat outside the very CI-guard doctrine the sibling file establishes: a future edit weakening it
would pass CI silently.

Two honest corrections earned this diagnosis, not assumed it (§5 — distrust the confident first read):
- My first read called this a DRY problem and suggested reusing `isSalesCoachManager`. That was WRONG: the
  layout gate is a *membership* check (admin **or staff** may enter their own area), strictly wider than the
  *manager* check (`sales_coach_role==='admin'`). Reusing the manager predicate would have **locked staff reps
  out** — a bug. Verified against `skillAccess.ts:18` before acting.
- So the fix is a NEW pure predicate `isSalesCoachMember` (the superset), not reuse of the manager one.

Root cause (structural-gap, not a runtime bug): the gate is CORRECT today; the defect is that it is
unguarded — no pure function, no test — against future silent weakening, breaking parity with its own file's
doctrine and its care sibling.

## 3. Design + interconnection (§1.5 ripple)
Add `isSalesCoachMember(caller: SkillViewer)` beside `isSalesCoachManager` (same file, same shape), returning
`!!sales_coach_role || role ∈ {CEO,COO,admin}` — provably identical to the layout's inline predicate. Point the
layout at it. Add unit tests, the critical one pinning `member ⊋ manager` (staff = member true, manager false).
Ripple: behavior-preserving (same predicate, same redirect, same order); one new export; one import in the
layout; test count +4. No schema, no auth-rule change, no route touched.

## 4. Class sweep (A26)
Swept `src/app` + `src/components` for any OTHER inline copy of the membership predicate (a `!!sales_coach_role`
combined with a company-admin role check). Result: the layout (lines 60-61) was the SOLE site — all 18
`skillAccess` importers use the *manager* predicate, not membership. So this is single-site hardening, honestly
NOT a multi-site DRY consolidation; the value is CI-guarding a security gate per the file's doctrine, not
removing duplication.

## 5. Hypothesis
- **H1:** `isSalesCoachMember` returns true for admin|staff sales_coach_role and for CEO/COO/admin, false for a
  plain member and null; the layout redirects exactly the same callers as before; a staff rep is member=true /
  manager=false; typecheck clean; the new tests pass.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-02T03:43:22Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understanding precedes solving — I read BOTH predicates (member vs manager) to understand why they differ before touching the gate.", "how_this_build_will_embody_it": "Section 2 states the earned diagnosis, including the corrected first read." },
  { "id": "§0.1", "read_at": "2026-08-02T03:43:22Z", "source_file": "CLAUDE.md", "line_range": "20-40", "why_it_governs": "Methodology in the tree, consulted this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; hashes in build.md." },
  { "id": "§1.5.1", "read_at": "2026-08-02T03:43:22Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "Feature-workflow continuity — a staff rep's flow (enter their own coaching area) must not break.", "how_this_build_will_embody_it": "isSalesCoachMember is the SUPERSET that keeps staff reps admitted; the pinned test guards it." },
  { "id": "A19", "read_at": "2026-08-02T03:43:22Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present before citing." },
  { "id": "A22", "read_at": "2026-08-02T03:43:22Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + the Session-Reads commit trailer." },
  { "id": "A30", "read_at": "2026-08-02T03:43:22Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "The predicate's doc comment + the member⊋manager test state why the two gates must stay distinct." },
  { "id": "§1.5", "read_at": "2026-08-02T03:43:22Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic ripple trace before a change touching shared access logic.", "how_this_build_will_embody_it": "Section 3 traces the ripple: behavior-preserving, one export, one import, no route/schema/auth change." },
  { "id": "§1.5.2", "read_at": "2026-08-02T03:43:22Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search proactive audit is what surfaced the unguarded gate.", "how_this_build_will_embody_it": "Section 2 records the layout-vs-layout audit that found it; Section 4 the sweep." },
  { "id": "§3.3", "read_at": "2026-08-02T03:43:22Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Guide, don't overtake — a change to a security gate must not smuggle a product decision.", "how_this_build_will_embody_it": "Behavior is preserved EXACTLY (same predicate); no access rule is changed, only its factoring + test." },
  { "id": "§5", "read_at": "2026-08-02T03:43:22Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Distrust the confident answer — my first read misdiagnosed this as reuse-the-manager-gate.", "how_this_build_will_embody_it": "Section 2 records the correction that reuse would lock staff reps out; the fix is a new superset predicate." },
  { "id": "§6", "read_at": "2026-08-02T03:43:22Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "Diagnosed, swept, ripple-traced, why-explained, behavior-preserving." },
  { "id": "A26", "read_at": "2026-08-02T03:43:22Z", "source_file": "ThinkerThinker.md", "line_range": "67", "why_it_governs": "A found gap is a CLASS — sweep for other inline copies.", "how_this_build_will_embody_it": "Section 4 swept src/app + src/components; single-site confirmed." },
  { "id": "A38", "read_at": "2026-08-02T03:43:22Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes the typecheck + vitest output." }
]
```
