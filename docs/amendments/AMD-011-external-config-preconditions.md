# AMD-011 — A config-dependent feature is not operationally complete until its external-config precondition is verified or flagged

- **Status:** ratified — founder-directed 2026-08-14 ("This system failure goes directly against ThinkerThinker.md and CLAUDE.md and needs to be fixed/amended"). The founder is the §7.2 ratifier (AMD-008 precedent).
- **Date proposed:** 2026-08-14
- **Proposed by:** founder directive, after the password-recovery outage — formalized by the agent into the §7.2 soundness gate.
- **Affects:** CLAUDE.md §1.5.1 (extends layer-2 "operational effectivity" with a new sub-clause **§1.5.3**); reinforces §0.1 (precondition gates) and §6 (checklist adds item 5c). Introduces `docs/AUTH-REDIRECTS.md` (the auth-redirect config contract) and `docs/CONFIG-PRECONDITIONS-AUDIT.md` (the class sweep). Companion asset lesson: **ThinkerThinker A41**.

---

## Trigger (§7.2.1 — triggered by evidence)

**The 2026-08-14 password-recovery outage.** A locked-out user's "Reset your password" email link opened the
**marketing project** (`…-iota.vercel.app`) instead of the set-new-password form — so he could not recover his
account. The recovery *code* was correct on both ends (`/auth/forgot` requested `redirectTo: …/auth/recover`;
`/auth/recover` consumed the token and set the password); `passwordRecovery.test.ts` was green; the build passed.
The feature was nonetheless **broken end-to-end**, because Supabase only honors a `redirectTo` that is in its
Redirect-URLs **allowlist** and otherwise silently falls back to the **Site URL** — an **external configuration**
that lives in the Supabase dashboard, not the repo, and that was never verified.

Aggravating record: earlier **this same session** the agent built the "forgot password" request flow and reported
it complete, without ever surfacing that the flow's end-to-end correctness depended on a Supabase allowlist entry
that a human had to set. The founder's words: *"This should have been one of the findings."*

## Diagnosis (§7.2.2 — diagnosed, not preferred)

§1.5.1 already requires **layer-2 operational effectivity**: *"does the feature, when invoked the way a real user
would invoke it, actually deliver the intended result — not 'does the unit test pass' — does it work, end-to-
end?"* The failure was reading that as *"does the code path work"* and stopping there. But end-to-end operation of
this feature depended on config **outside the code** (a Supabase allowlist), and §1.5.1 as written never names
external-config preconditions as part of "does it work." So the layer-2 check passed on a green build while the
real user flow was dead. The gap is specific and stated: **§1.5.1 does not distinguish "the code is correct" from
"the feature works," when the difference is an unverified external precondition.** Silent dependence on
unverified external config is invisible to typecheck, lint, and unit tests **by construction** — the same
structural blind spot as A39's attribution failure (well-formed by construction, wrong in reality).

## The amendment (the new rule — CLAUDE.md §1.5.3)

> **§1.5.3 — External-config completeness.** A feature whose correctness depends on configuration that lives
> **outside the repository** — third-party dashboard settings (Supabase Site URL / Redirect-URLs allowlist,
> Postmark webhook, an OAuth callback registry), environment variables, DNS, or webhook secrets — is **not
> operationally complete (§1.5.1 layer 2)** until that precondition is either:
> 1. **verified working end-to-end** against the live config, or
> 2. **documented as a blocking setup step** — its required values and a verification procedure recorded on the
>    record (e.g. `docs/AUTH-REDIRECTS.md`) — AND surfaced to the founder as a precondition, not buried.
>
> "The code is correct and it builds" is **not** "it works" when an external precondition is unmet. Prefer making
> the dependency **fail LOUD** (a visible 5xx / health-flag / empty-with-notice) over failing **silently**;
> silent dependence on unverified external config is the defect this clause exists to catch.

## Ripple-trace (§7.2.3 — Rule 1.5)

- **§1.5.1**: extended, not contradicted — §1.5.3 is a named sub-case of layer-2 effectivity. No other layer changes.
- **§0.1 (precondition gate)**: reinforced — the methodology-in-tree gate is the *internal* precondition; §1.5.3
  is its *external* twin (config the repo can't hold).
- **§6 (checklist)**: adds **5c** — "Does this feature depend on config outside the repo? If so, is that
  precondition verified end-to-end or documented+flagged as a blocking setup step?"
- **§5 (honesty)**: consistent — reporting "done" on a feature whose external precondition is unverified is the
  confident-but-empty claim §5 forbids.
- No silent contradiction introduced. Verified: the invariant that guards constitution metadata (INVARIANT 12)
  is satisfied by bumping `src/lib/constitution.ts` to AMD-011 in the same change.

## Alternative-tested (§7.2.4 — outperforms the prior rule on the triggering incident)

Under §1.5.1 alone the recovery flow shipped "complete." Under §1.5.3, building it forces the agent to either
verify the Supabase allowlist end-to-end (catching the fallback), or write the config contract + flag it to the
founder as a required setup step (`docs/AUTH-REDIRECTS.md`) — either path stops the silent outage. The rule is
strictly stronger on the exact incident.

## Outside-view (§7.2.5)

A reader with no stake sees "the code is right but the user can't reset their password" as an operational-
effectivity failure the constitution should already catch — and sees the fix (name external-config as part of
"does it work") as the obvious closure. Survives the disinterested reading.

## Does not soften under pressure (§7.2.6)

It **adds** a verification burden (verify or document external config before claiming done); it removes no
friction for the builder. It is the opposite of a shortcut.

---

## Decision

**Ratified, founder-directed, 2026-08-14.** CLAUDE.md gains §1.5.3 and a §6 checklist item; `src/lib/constitution.ts`
bumped to version 1.11 / count 9 / AMD-011; ThinkerThinker.md gains A41. The password-recovery flow is fixed
(canonical redirects, `docs/AUTH-REDIRECTS.md`) and the class is swept (`docs/CONFIG-PRECONDITIONS-AUDIT.md`).
