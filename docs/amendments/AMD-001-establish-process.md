# AMD-001 — Establish the amendment process

- **Status:** ratified
- **Date:** 2026-05-16
- **Proposed by:** founder directive (in-session decision: "Adopt as constitution" + "create adaptation policy, our amendments to our 'law' but the logic must be sound before it can be an amendment")
- **Affects:** CLAUDE.md (adds Section 7)

---

## Trigger

The constitution was adopted as the project's operating law immediately upon being read. On adoption, an audit found multiple direct violations in the existing codebase (see session record: "Retrospective audit — what we built that violates the constitution"). At least two distinct categories of friction surfaced within minutes of adoption:

1. The constitution declares itself the supreme rule but specifies no mechanism for evolving its text. Section 4 ("Evolving the Method Itself") describes evolution of *the System's diagnostic methods*, not of the constitution's own clauses.
2. The audit raised legitimate refactor questions (events vs. state tables, instant scores, pre-asserted diagnoses) that may require constitutional clarification or amendment to resolve coherently. Without a process, those clarifications would happen informally — the exact "knowledge imitating intelligence" failure mode (Rule 5).

These are **structural gap incidents**, not rule-failure incidents. The bootstrap exception in the soundness gate applies.

## Diagnosis

The existing rule (absence of an amendment process) produces one of two failure modes, both forbidden:

- **Freeze.** Without a process, the constitution cannot change. Real friction from real incidents has no legitimate path into the law. Over time the constitution drifts from what the project actually needs, and is either ignored quietly or rewritten by fiat — both fatal to the discipline.
- **Informal drift.** Without a documented process and a default-deny soundness gate, any sufficiently confident, fluent argument can soften a rule under pressure. Rule 5 explicitly anticipates this: "The biggest risk is the builder under pressure … the temptation will be to make it *less honest* for a faster result." A constitution with no amendment discipline is a constitution that loses to a determined builder under deadline.

The root cause: the constitution describes *how thinking must work* but not *how its own rules evolve*. A self-aware constitution must include the meta-rule that governs its own change, or it is structurally incomplete.

## Ripple-trace

- **Section 4 (Evolving the Method).** Clarifies that Section 4 governs the System's *methods*, while Section 7 governs the constitution's *text*. No contradiction introduced; complementary scopes.
- **Section 3.1 (Events are immutable).** The amendments folder is itself an event log — append-only, never overwritten. The constitution's evolution obeys the same rule it imposes on the System. Coherent.
- **Section 5 (Knowledge ≠ intelligence; biggest risk is the builder under pressure).** The default-deny soundness gate is the structural protection Section 5 anticipates. Reinforces.
- **No other section is loosened or contradicted.**

## Alternative-test

This is a **structural-gap amendment**: there is no prior rule to test against, only an absence. The alternative is "no process at all," which the Diagnosis section identifies as failing both freeze and informal-drift modes.

Future amendments will be testable against AMD-001's soundness gate. AMD-001 itself is the baseline.

## Outside-view check

Read as if I had no investment in proposing it: does it survive?

- Does it loosen the constitution under builder pressure? **No** — it adds friction, doesn't remove it. Default deny.
- Does it create a back-door for confident-but-wrong amendments? **No** — every section of the proposal template is designed to catch knowledge-imitating-intelligence (trigger requires incidents, diagnosis requires *why*, alternative-test requires comparison).
- Could it be silently bypassed? Only if `CLAUDE.md` is edited without an accompanying amendment file. Future agent behavior (Section 7.4 in the proposed change) explicitly prohibits that.
- Is it self-applying? **Yes** — this amendment was authored to its own template.

Passes.

## Proposed change

Append the following to `CLAUDE.md` as **Section 7**:

> ## 7. Amendment Process (how this constitution evolves)
>
> The constitution is the supreme rule but it is not frozen. It evolves through a structural process modeled on the same discipline it imposes on the System.
>
> ### 7.1 Default deny
>
> Every proposed change to the text of this constitution is denied unless a sound, earned, on-record amendment proposal demonstrates otherwise. The constitution holds; the burden of proof is on the proposer.
>
> ### 7.2 Soundness gate
>
> A proposal is ratified only if every check below passes. Any single failure → denied.
>
> 1. **Triggered by evidence.** ≥1 documented incident from the project record where the existing rule produced wrong behavior. (Structural-gap exception: a proposal that fills a missing rule rather than amending an existing one may substitute a documented gap-identification.)
> 2. **Diagnosed, not preferred.** The proposal must explain *why* the existing rule produced wrong behavior, from the record. Preference is not a diagnosis.
> 3. **Ripple-traced.** The proposal enumerates every other section/rule it affects and confirms no silent contradictions are introduced. (Rule 1.5.)
> 4. **Alternative-tested.** The proposed rule outperforms the existing rule on the triggering incidents. Where the change is structural-gap-filling, this is explicitly stated. (Rule 4.)
> 5. **Outside-view checked.** The proposal survives a reading by a stance with no investment in adopting it. (Rule 1.3.)
> 6. **Does not soften under pressure.** A proposal that reduces friction *for the builder* without producing better outcomes *for the System* is rejected. (Rule 5.)
>
> ### 7.3 Append-only audit trail
>
> Every proposal — ratified, denied, or deferred — lives in `docs/amendments/` as `AMD-XXX-slug.md`. Files are append-only; status changes are recorded by appending, never by editing. The folder is the immutable record; `CLAUDE.md` is the derived current state. (Rule 3.1.)
>
> ### 7.4 Editing CLAUDE.md
>
> The text of this constitution may only be modified as the consequence of a ratified amendment. Any edit must reference its amendment by ID in the commit message. An edit without a backing amendment is a violation of Section 7 and must be reverted.
>
> ### 7.5 Distrust of evolution
>
> Per Rule 4: the constitution refuses to believe its own evolution until results prove it. A ratified amendment that, after some period of operation, produces measurably worse outcomes than the rule it replaced is itself eligible for a counter-amendment. The constitution is not a one-way ratchet.

## Decision

**Ratified** — founder directive (bootstrap) + soundness gate passed.

## Status Update — 2026-05-16

Ratified. CLAUDE.md will be edited to include Section 7. This file is now part of the canonical record.
