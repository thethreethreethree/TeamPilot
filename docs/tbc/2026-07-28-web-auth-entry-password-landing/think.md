---
tbc_version: 1
trigger: feature
started_at: 2026-07-28T14:16:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 4
---

# THINK — auth-entry: show-password toggle (Task 1) + module-aware landing (Task 2)

Two founder-requested changes to the sign-in / account-entry surfaces, in one build because
both live in the auth-entry area.

## 1. Document integrity (§0.1)

`find` + `sha256sum` + `wc -l` run this session. CLAUDE.md `e08874…` / 429L and
ThinkerThinker.md `0428b0bb…` / 1039L both **MATCH** `docs/tbc/DOC_MANIFEST.json`. Proceed.

## 2. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-28T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understand before solving — Task 2 is a redirect BUG, so it must be diagnosed to root cause (login ignores module) before a fix, not patched by symptom.", "how_this_build_will_embody_it": "The login redirect was read and the exact hardcoded /dashboard identified before writing the resolver." },
  { "id": "§0.1",   "read_at": "2026-07-28T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the working tree, read this session — the manifest records the reads behind the build.", "how_this_build_will_embody_it": "read_at is this session; ranges gate-checked against the live docs." },
  { "id": "§1.5.1", "read_at": "2026-07-28T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four-layer framework — both changes are user-facing; layer 3 (composition/continuity) is the whole point of Task 2 (land the user where they can work, not stalled on main).", "how_this_build_will_embody_it": "Section 5 walks the layers; the redirect fix is justified at layer 3." },
  { "id": "§1.5.2", "read_at": "2026-07-28T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — hypotheses about how the auth entry fails were formed, then confirmed by reading login/redeem, not grep-first.", "how_this_build_will_embody_it": "Hypotheses below were written against the surface; the login-ignores-module one is already confirmed." },
  { "id": "§6",     "read_at": "2026-07-28T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "The decision checklist — item 5a (workflow continuity) is exactly Task 2; the fix follows the redeem precedent rather than a self-substituted design.", "how_this_build_will_embody_it": "The landing map mirrors the redeem precedent (A28), and login is left in a flowing state." },
  { "id": "A19",    "read_at": "2026-07-28T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree — read live, recorded here.", "how_this_build_will_embody_it": "The manifest carries this-session reads." },
  { "id": "A21",    "read_at": "2026-07-28T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-550", "why_it_governs": "Same-concept-different-behaviour across surfaces: 'where does auth land the user' exists in BOTH login and redeem. Today they disagree (login → /dashboard always; redeem → by module). That split IS the bug.", "how_this_build_will_embody_it": "A single shared moduleLanding()/resolver is used by both, so they can no longer diverge." },
  { "id": "A22",    "read_at": "2026-07-28T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations; this manifest is the artifact that makes the reads checkable.", "how_this_build_will_embody_it": "Every id cited in these artifacts resolves to an entry here with a this-session read_at." },
  { "id": "A28",    "read_at": "2026-07-28T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "A precedent in the codebase already decides what looks like a design choice: redeem/route.ts LANDING already maps module→path. Task 2 is an ALIGNMENT to that precedent, not a new invention to flag.", "how_this_build_will_embody_it": "The resolver reuses redeem's exact mapping; login adopts it instead of hardcoding /dashboard." },
  { "id": "A30",    "read_at": "2026-07-28T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A fix must be encoded so it cannot silently regress — putting the mapping in ONE shared function means a future divergence is a code change to that function, not a quiet drift.", "how_this_build_will_embody_it": "moduleLanding lives in one lib module; both callers import it." },
  { "id": "A31",    "read_at": "2026-07-28T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-820", "why_it_governs": "Schema-complete is not built — a landing resolver that nothing calls, or a toggle that flips a var nothing reads, is dead. Both changes need a real write-path AND read-path.", "how_this_build_will_embody_it": "build.md asserts: the resolver's read-path is login actually navigating to it; the toggle's read-path is the input's type actually changing." },
  { "id": "A38",    "read_at": "2026-07-28T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a claim about a command — the build closes only after npm run check is run by name with its exit code pasted.", "how_this_build_will_embody_it": "closure.md pastes the canonical command output." }
]
```

## 3. Hypotheses (before deeper search)

```json
[
  { "id": "H1", "claim": "The login redirect ignores the user's module, sending every returning user with a company to /dashboard (main).", "confidence": "high", "test": "Read login/page.tsx post-signin router.push.", "outcome": "CONFIRMED — login/page.tsx:113 pushes buildDestination('/dashboard') for any profile.company_id; module is never read." },
  { "id": "H2", "claim": "The redeem flow already routes by module, so the divergence between login and redeem is the A21 split to close with a shared helper.", "confidence": "high", "test": "Read redeem/route.ts LANDING map.", "outcome": "CONFIRMED — redeem/route.ts:20 maps care→/dashboard/care, sales_coach→/dashboard/sales-coach, elostate→/dashboard." },
  { "id": "H3", "claim": "A user's module is derivable server-side from levers (profiles.sales_coach_role + a care_tenant_config row for the company); there is no single 'module' column.", "confidence": "medium", "test": "Read the entitlement map + confirm care_tenant_config / sales_coach_role are the levers.", "outcome": "CONFIRMED by the settings/entitlement map — no unified module gate; care via care_tenant_config.plan, sales_coach via profiles.sales_coach_role, elostate = both." },
  { "id": "H4", "claim": "The show-password toggle can flip a single input between type=password/text without breaking autoComplete or password managers, if it toggles only the `type` attr and preserves all other props.", "confidence": "high", "test": "Build PasswordInput that spreads props + toggles type; verify autoComplete is preserved on all 6 sites.", "outcome": "pending BUILD." }
]
```

## 4. Spec fidelity

- **Restated:** (1) add a show/hide toggle to password fields so a user can see what they typed; (2) fix the post-auth redirect so users land in the module they signed up for, on both app and website, instead of always main.
- **As written, no deviation.** Task 2's landing rule is the founder's explicit choice (single module → module; both/neither → hub), which matches the redeem precedent (A28) — so it is an alignment, not a preference I am substituting.
- **Precedent search (A28):** redeem/route.ts already decides module→path. Login adopts it. No founder decision to flag; the multi-module behaviour question was surfaced and answered ("full/multi → hub").
- **Conflicts:** none. One note surfaced separately (not built here): signup sets no `emailRedirectTo`, so the email-confirm link uses Supabase's Site URL — a config check, out of this build's scope.

## 5. Four-layer pre-walk (§1.5.1)

- **1 structure:** `PasswordInput` (one reusable component, spreads props, toggles only `type`); `src/lib/nav/landing.ts` (one `moduleLanding` map + `resolveUserLanding`), consumed by login (via `/api/me/landing`) and redeem. No duplication, no A21 split.
- **2 effectivity:** invoked as a real user does — clicking the eye reveals the typed password; signing in as a care-only user navigates to /dashboard/care. Confirmed in build/check.
- **3 composition:** BEFORE — a care user signs in and lands on main, confused/stalled (the reported bug). AFTER — they land in their module, flowing. The toggle lets a user verify a password before submit, cutting failed-login retries. This is the layer the bug lived in.
- **4 surface:** eye/eye-off icon (lucide, consistent with the app); module landing consistent with each module's home.

**verdict: SHIPPABLE.**
