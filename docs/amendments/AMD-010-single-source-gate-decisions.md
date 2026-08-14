# AMD-010 — A gate/authorization decision is returned as a verdict and consumed, never re-derived by a downstream consumer

- **Status:** ratified — founder directive 2026-08-14 ("provide me the root cause … update ThinkerThinker.md and CLAUDE.md to create an amendment that will prevent this type of issue from happening again"). The founder is the §7.2.5 disinterested outside-view party and the AMD-001 §7.2 ratifier. Proposal text below is preserved append-only (§7.3); the decision is recorded here.
- **Date proposed:** 2026-08-14
- **Proposed by:** founder directive, after the account-based empty-AI outage, formalized by the agent into the §7.2 soundness gate.
- **Affects:** CLAUDE.md §2 (adds §2.2 "Single-source decisions — consume the verdict, don't re-derive the gate"); reinforces §1.5 (holistic ripple), §3.2/§3.4 (structural gates), §2 (no error loops). Captured operationally as `ThinkerThinker.md` **A40**.

---

## Trigger (§7.2.1 — triggered by evidence)

One documented incident from the project record in which an existing rule was **correct** and produced **wrong behaviour** because a decision it made was silently overridden by a duplicated copy of its own condition:

- **The account-based empty-AI outage, 2026-08-14** (`c7e719f6`; retrospective `scripts/diag-empty-reads.mjs`). For ~weeks, every Sales Coach account whose company had `ai_guidance_enabled=false` received a 100%-EMPTY "Your read" and zero live cues, while admin accounts (guidance-on) worked. Prod data: guidance-off companies 13/13, 8/8, 6/6 empty; guidance-on worked, independent of corpus size. The founder's same-device A/B (log out of a guidance-off account → into an admin account → full read) isolated it to the account/company, not the device or the transcript.

The §3.4 control gate decision — *suppress ⇔ `(!guidanceEnabled && !controlExempt)`* — was authored correctly in ONE place (`runBrainCall`), which honored the Sales-Coach `controlExempt` flag and RAN the LLM, returning the real answer. But a downstream consumer, the shared `call()` wrapper (`src/lib/claude.ts`), RE-DERIVED that decision from the raw gate state and checked `!gate.guidanceEnabled` **alone** — the `controlExempt` term had drifted out of the copy — and DISCARDED the real answer. The exemption was honored at the authority and thrown away one layer above it, while the LLM call was still billed.

## Diagnosis (§7.2.2 — diagnosed, not preferred)

The existing structural-gate rules (§3.2/§3.4) say the gate must be encoded, not left to discretion — and it WAS encoded, correctly, at the authority. They are silent on the failure that actually occurred: a **second copy of the gate decision, re-derived by a consumer, drifting from the authority**. The mechanism is specific and repeatable:

- A decision (`suppress`/`allow`) is computed at an authority AND separately re-derived by a consumer from the same raw inputs.
- A term is later added to the decision at the authority (here `controlExempt`, when Sales Coach became day-1) and NOT added to the consumer's copy.
- The copies now disagree; the consumer silently overrides the authority. Every automated check stays green — types sound, the call succeeds and is billed, a well-formed empty result flows out, and callers read "empty" as "no signal." It is the §0 confident-well-formed-failure at the gate layer, invisible until a human notices a whole class of accounts is dark.

This is not a preference for tidier code; it is a named drift mechanism with a documented outage. The rule that closes it: **a decision is returned as a verdict and consumed; it is not re-computed downstream.**

## The amendment (the rule)

Adds **CLAUDE.md §2.2**:

> **2.2 Single-source decisions — consume the verdict, don't re-derive the gate.**
> When an authority (a gate loader, an auth check, an eligibility/visibility resolver) computes a decision, it MUST return that decision as an explicit verdict (a boolean/enum such as `suppressed`, `allowed`, `visible`), and every downstream consumer MUST branch on the returned verdict — never re-derive the same decision from the raw inputs the authority already judged. Re-deriving a decision duplicates its condition, and duplicated conditions drift: a term added to one copy and not the other silently defeats the gate, with every automated check green. Where a re-derivation is genuinely unavoidable, it MUST mirror the authority's condition term-for-term with a comment pointing at the source, AND a drift-guard test MUST exercise BOTH branches of every term — especially exemption/override terms, which are added late and forgotten in the copy. This is most dangerous when the authority runs an expensive side effect (an LLM call, a charge, a write) before returning: a consumer that discards the result on a re-derived gate burns that cost and emits an empty-but-billed result.

## Ripple-trace (§7.2.3 — enumerates affected rules, no silent contradictions)

- **§1.5 (holistic).** Strengthens it: "trace what else this change affects" now explicitly includes every place a decision is re-derived. No contradiction — this is §1.5 applied to decision logic.
- **§3.2 / §3.4 (structural gates).** Complements them: they require the gate be encoded; §2.2 requires it be encoded ONCE and consumed, so a second copy cannot invert it. No contradiction.
- **§2 (no error loops).** The incident also exercised §2 — the first "starvation" diagnosis didn't hold and was pushed harder; the record (prod data) is what broke the wrong theory. §2.2 does not alter §2; A40 records the §2 lesson alongside.
- **§6 (checklist).** Gains a natural check ("is any decision re-derived from inputs an authority already judged?") but the checklist text is not edited here; A40's future-use questions carry it operationally.
- No section is weakened. No rule now contradicts another.

## Alternative-tested (§7.2.4 — outperforms the existing rule on the triggering incident)

Under the pre-amendment rules, `call()`'s re-derivation passed every gate (types, tests, lint, RLS/invariant audits) and shipped the outage. Under §2.2: `runBrainCall` returns an explicit `suppressed` verdict (or, at minimum, the re-derivation mirrors the term with a drift-guard test on both the exempt and non-exempt branches). Either form makes the 2026-08-14 outage impossible to ship silently — the missing `controlExempt` term is now either structurally absent (there is no second copy) or caught by the mandated both-branches test. This is a structural-gap fill: the existing rules had no clause against re-derived decisions.

## Outside-view (§7.2.5) & does-not-soften (§7.2.6)

- Outside-view: a detached reader sees "the same gate variable tested in two files" as an obvious smell; the amendment names it. Founder-ratified as the disinterested party.
- Does not soften under pressure: §2.2 ADDS discipline (return a verdict; test both branches) — it reduces friction for no one and removes a real failure mode. It cannot be used to justify a faster, less-honest path.

## Distrust of evolution (§7.5)

If, in operation, §2.2 produces measurably worse outcomes than its absence (e.g., it is cited to block legitimate work, or the verdict-return pattern proves to cause more drift than it prevents), it is itself eligible for a counter-amendment. The interim guard for the triggering class is `src/lib/__tests__/claude.controlExempt.test.ts`.
