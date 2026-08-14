---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T15:00:00Z
doc_hashes:
  CLAUDE.md: 3325eedc1e905b2798d196dae087664e3da7031a66005b1f89379b6da959a9e3
  ThinkerThinker.md: 19d6ff103082c1f29ee98653b84cce2a26308352511756f6e104a8db36df84c9
manifest_entries: 15
hypotheses: 1
---

# THINK — password recovery: fix the canonical-redirect drift + amend the constitution (external-config completeness)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (3325eedc…) + ThinkerThinker.md (19d6ff10…) in-tree, hashes verified AFTER this change's edits
(the amendment edits both governing docs; the manifest records the post-edit hashes).

## 2. Why (founder-directed, from the record §1.2)
User feedback: a locked-out account's reset-password email opened the MARKETING project (`…-iota.vercel.app`),
not the set-new-password form. Diagnosed from the record (screenshot host + `/api/health` deploymentUrl): the
recovery CODE is correct on both ends; the break is Supabase URL-config (Site URL points at the marketing
project + `/auth/recover` not allow-listed → Supabase ignores `redirectTo`, falls back to Site URL), compounded
by the reset link using `window.location.origin` across two Vercel projects. The founder directed: apply the fix,
audit the class, and AMEND — "this goes directly against ThinkerThinker.md and CLAUDE.md."

## 3. The fix + the amendment
- **Code (FIX 1):** every auth email-redirect is built from ONE canonical origin (`siteUrl()`), never the browser
  origin — `canonicalRecoverUrl()` (forgot) + `signupConfirmRedirectUrl()` (the 3 signups' `emailRedirectTo`).
  One URL to allow-list; it can't drift onto a preview/marketing domain. Locked by `passwordRecovery.test.ts`.
- **Config contract:** `docs/AUTH-REDIRECTS.md` — the required Supabase settings + an end-to-end verification
  procedure (turns the silent precondition into a verifiable one).
- **Audit:** `docs/CONFIG-PRECONDITIONS-AUDIT.md` — the class swept; auth surface closed; push (VAPID) + care-email
  flagged as the remaining silent-config surfaces.
- **Amendment (§7):** AMD-011 ratified (founder-directed). CLAUDE.md gains **§1.5.3** (external-config
  completeness) + checklist item 5c; ThinkerThinker.md gains **A41**; `src/lib/constitution.ts` → 1.11 / count 9 /
  AMD-011 (INVARIANT 12).

## 4. Interconnections traced (§1.5)
- INVARIANT 12 (constitution metadata) — bumped `constitution.ts` in lockstep (count 9 = 001-006+008+010+011;
  lastAmendmentId AMD-011); AMD-011 carries `**Status:** ratified` so the invariant counts it.
- §7 soundness gate — AMD-011 passes all six checks (evidence-triggered, diagnosed, ripple-traced, alt-tested,
  outside-view, no-soften); recorded append-only in `docs/amendments/`.
- No engine/behaviour change beyond the redirect targets; the recovery + signup flows are otherwise unchanged.

## 5. Hypothesis (§1.5.2)
- **H1 — do the canonical helpers always target the configured app origin regardless of caller origin?** YES —
  they take NO origin argument (built from `siteUrl()`); `passwordRecovery.test.ts` pins
  `canonicalRecoverUrl()`=`<siteUrl>/auth/recover` and `signupConfirmRedirectUrl()`=`<siteUrl>/login`, trailing
  slash safe.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T15:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand precedes solving — diagnose the recovery break from the record before fixing.", "how_this_build_will_embody_it": "Traced the redirect config from the screenshot + code before changing a line." },
  { "id": "§0.1", "read_at": "2026-08-14T15:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition — twin of the new external-config precondition.", "how_this_build_will_embody_it": "Doc hashes verified post-edit; §1.5.3 named as §0.1's external mirror." },
  { "id": "§1.2", "read_at": "2026-08-14T15:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective — diagnose from the actual record.", "how_this_build_will_embody_it": "Used the screenshot host + /api/health deploymentUrl to prove the two-project misconfig." },
  { "id": "§1.5.1", "read_at": "2026-08-14T15:01:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 operational effectivity — the feature looked done (green build) but didn't work end-to-end.", "how_this_build_will_embody_it": "§1.5.3 extends layer-2 to name external-config preconditions as part of 'does it work'." },
  { "id": "§1.5", "read_at": "2026-08-14T15:01:40Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — trace what else the redirect change + the amendment touch (INVARIANT 12, the manifest, §7).", "how_this_build_will_embody_it": "Section 4 enumerates the ripple (constitution.ts, DOC_MANIFEST, no behaviour change)." },
  { "id": "§1.5.2", "read_at": "2026-08-14T15:01:50Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesised the drift, confirmed by reading the call sites + siteUrl before fixing.", "how_this_build_will_embody_it": "H1 gated by passwordRecovery.test.ts." },
  { "id": "§7.2", "read_at": "2026-08-14T15:03:40Z", "source_file": "CLAUDE.md", "line_range": "410-470", "why_it_governs": "Soundness gate — AMD-011 must pass all six checks to ratify.", "how_this_build_will_embody_it": "AMD-011 enumerates trigger/diagnosis/ripple/alt-test/outside-view/no-soften." },
  { "id": "§1.5.3", "read_at": "2026-08-14T15:02:00Z", "source_file": "CLAUDE.md", "line_range": "174-200", "why_it_governs": "The new clause this build ratifies + embodies.", "how_this_build_will_embody_it": "Canonical redirects + AUTH-REDIRECTS.md (verified/documented precondition) + fail-loud audit." },
  { "id": "§5", "read_at": "2026-08-14T15:02:30Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Honesty — 'the code is correct' reported as 'it works' is the confident-empty claim.", "how_this_build_will_embody_it": "The config contract + verification procedure replace the assumption with a check." },
  { "id": "§6", "read_at": "2026-08-14T15:03:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — adds item 5c (external-config precondition).", "how_this_build_will_embody_it": "5c authored + this build answers it (verified+documented)." },
  { "id": "§7", "read_at": "2026-08-14T15:03:30Z", "source_file": "CLAUDE.md", "line_range": "410-470", "why_it_governs": "Amendment process — AMD-011 must pass the soundness gate + append-only trail.", "how_this_build_will_embody_it": "AMD-011 written with all six §7.2 checks; constitution.ts bumped; INVARIANT 12 satisfied." },
  { "id": "A19", "read_at": "2026-08-14T15:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read forgot/recover/login/invite/redeem + passwordRecovery + siteUrl before editing." },
  { "id": "A22", "read_at": "2026-08-14T15:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendment sections + A40 read this session." },
  { "id": "A30", "read_at": "2026-08-14T15:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate, not just prose.", "how_this_build_will_embody_it": "§6 checklist 5c + the two config docs + passwordRecovery drift-guard test — the class can't silently recur." },
  { "id": "A38", "read_at": "2026-08-14T15:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit code." }
]
```
