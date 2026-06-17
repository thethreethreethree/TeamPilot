# AMD-006 — Feature builds require system-flow + user-flow tracing as a precondition

- **Status:** ratified
- **Date proposed:** 2026-06-17
- **Date ratified:** 2026-06-17
- **Proposed by:** founder directive ("add this as an amendment rule specifically for web/app development every system built needs to have a complete understanding of why it is built…")
- **Ratified by:** same founder directive (the proposal and the ratification are the same statement; §7.4 amendment-only-via-ratified-amendment is satisfied — the founder is the ratifier per AMD-001 §7.2)
- **Affects:** CLAUDE.md §1.5 Organic + Holistic Solutioning — adds §1.5.1 sub-clause (feature-workflow precondition gate); CLAUDE.md §6 Quick Decision Checklist — adds item 5a; reinforces §0 (understanding precedes solving) and ThinkerThinker.md A8 (affordance composition).

---

## Trigger

Today (2026-06-17), commit `d9523a0` — "feat(care): auto-advance to next conversation after Close / Resolve."

The Close button shipped in `b381410` was technically complete: it set `status='closed'` and re-rendered. The button worked. The status transitioned. The agent saw the toast. By any technical-completeness criterion, the feature was done.

It was operationally incomplete. The user closed a conversation while triaging through the Unassigned queue, and the screen dropped to a "Select a conversation" empty state. The next conversation in the list did NOT slide into focus. The agent's intent — "finish this one, keep moving" — was broken by an empty-state interrupt that the feature build never accounted for.

The user surfaced this with a screenshot annotated "after closing it should immediately open the next message," plus the framing question: *"can we follow this logic, and adjust the system based on this, this a common step by step action, and we need to eliminate unecessary steps."*

The shape of the failure: the feature was built as a discrete action (change status), not as a step in a workflow (triage one, move to next, triage that). The agent traced the data flow (status field, RLS, trigger emission) and the UI render (button click → PATCH → toast) but never asked "what does the user do *after* completing this action?" Had that single question been answered before the build, auto-advance would have been part of the original Close commit, not a follow-up.

This is the same failure class as CAT-001 (AMD-005) one level up: the build was structurally compatible with itself but not with the operational reality it lives in. CAT-001 was "I built without consulting the methodology"; AMD-006 is "I built without consulting the workflow."

The triggering incident is bounded: one commit, caught the same day, fixed within minutes. The pattern, however, is recurring. It is the standard shape of "feature works in isolation, breaks the workflow it lives inside" — a failure mode any feature build is exposed to absent an explicit gate.

## Diagnosis

§1.5 ("consider the whole system and its interconnections; never fix one thing in a way that silently breaks another") covers system-level interconnection. It does not explicitly cover *workflow*-level interconnection — the user's sequence of actions that the feature sits inside.

The distinction matters because system-tracing and workflow-tracing surface different gaps:

- **System-tracing** (existing §1.5): does this change break other code, other features, other tenants? — Answer for Close-as-shipped: no. The status field worked. RLS held. Other features were unaffected.
- **Workflow-tracing** (proposed §1.5.1): does this feature leave the user in a flowing state or a stalled one? What does the user do right before this action, and what do they want to do right after? — Answer for Close-as-shipped: stalled. User wanted to continue triaging. Feature dropped them into an empty state.

§1.5 alone passed for the Close build. The agent considered "does this break other features" and answered correctly. The check that would have caught the gap — "does this leave the user able to continue" — was not in the rule set, so was not asked.

The behavioral fix ("I will trace user workflow before building") is exactly the A9 failure mode AMD-005 documents: discipline that depends on the agent remembering to apply it does not survive context loss or model swaps. The structural fix is a precondition gate at the §1.5 level: before building a user-facing feature, trace the workflow it lives in, not just the system it lives in.

The user's own phrasing identifies the failure class precisely: *"our system should think of how our built operates within the system itself, and how users will operate with them."* Two layers — system + operation. The amendment elevates "operation" (workflow) to the same precondition status that "system" (interconnection) already has.

## Ripple-trace

| Section | Effect | Coherence check |
|---|---|---|
| **§0 The One Law** | Reinforced. Workflow understanding is a form of "understanding the problem" that §0 already requires. AMD-006 makes that workflow-layer of understanding explicit. | No conflict. The existing §0 prose stays intact. |
| **§0.1 (AMD-005) Precondition gate** | Compositional. AMD-005 ensures the methodology source is in the working tree before substantive action. AMD-006 ensures the workflow context is traced before feature-level action. Stacked precondition gates. | No conflict. The gates fire at different layers of "before solving." |
| **§1.5 Organic + Holistic Solutioning** | Extended. The "holistic" half (system interconnection) gains an explicit sub-clause covering workflow interconnection. | Net additive. The existing "trace ripple effects before acting" sentence applies to system; the new §1.5.1 applies to workflow. |
| **§5 Standing Principles** | Reinforced. §5 names "knowledge ≠ intelligence" — fast confident answers that imitate understanding. Building a feature that completes a technical requirement without tracing its workflow is the same failure shape one level down: the build *imitates* a finished feature. | No conflict. |
| **§6 Quick Decision Checklist** | Adds item 5a: "For user-facing features, have I traced the user's workflow before AND after this feature, and does the feature leave them in a flowing state?" | Additive; doesn't loosen existing checklist items. |
| **§7 Amendment Process** | This amendment exercises §7. The fact that the rule it codifies (trace before building) was applied to the AMD-006 build itself — proposal traces why the rule exists, where it sits in the constitution, and how future builds will operate under it — is self-validating. | Self-coherent. |

ThinkerThinker.md assets affected:

- **A8 (affordance composition)** is the closest existing asset. A8 names that terminal actions should compose with workflow advancement. AMD-006 is the constitutional gate that makes A8's compositional discipline a precondition rather than a post-hoc check. A8 stays in TT.md; AMD-006 elevates its precondition status the same way AMD-005 elevated A19's.
- **A4 (defer uncertainties)**, **A18 (invitation labels)** all touch workflow continuity and remain coherent.

No silent contradictions introduced. The amendment closes a precondition gap rather than re-opening one.

## Alternative-test

Structural-gap-filling per §7.2 — codifies a rule that was implicit in §1.5 + A8 but never required as a precondition. The "alternative to test against" is the existing §1.5 prose alone, which was the operating rule during today's Close build and demonstrably failed to prevent the workflow-break.

The triggering incident IS the alternative-test:

- **Existing rule (§1.5 alone):** the agent traced ripple effects of the Close action (no other features broken) and considered it complete. The workflow gap was caught by the user, not by the rule. One round-trip with the user was required to fix it.
- **Proposed rule (§1.5 + §1.5.1):** the precondition gate would have surfaced "what does the user do after clicking Close?" before the original build. Answer: "continue triaging." Auto-advance would have shipped in the first Close commit; the round-trip with the user would not have occurred.

The proposed rule outperforms the existing rule on the triggering incident. The cost of the additional gate is one explicit "trace the workflow before/after" check per feature build — small relative to the round-trip cost it prevents.

## Outside-view check

Read by a stance with no investment in the amendment passing:

> "Is this just standard product-engineering discipline being formalized into a constitution? Why does it need constitutional weight?"

It does need constitutional weight. The Close incident proves that the discipline isn't applied automatically — even today, with explicit guidance from the user and a project history full of workflow-shaped lessons, the agent built a feature in isolation. Standard discipline that depends on remembering to apply it is exactly the discipline AMD-005 already identified as failing. The constitutional precondition gate makes the check structural, not optional.

> "Could this slow shipping by making every feature build expensive?"

Bounded. The gate is "trace the workflow before/after — what does the user do right before, what right after?" That's two questions, answered in seconds. The cost of NOT asking them, as today demonstrated, is a round-trip with the user plus a follow-up commit. The amendment trades a small predictable cost (two questions) for a larger unpredictable cost (user-caught workflow breaks).

> "Does the amendment loosen under pressure (§5)?"

It tightens. It adds a precondition that makes shipping technically-complete-but-operationally-incomplete features structurally harder. §5 pass.

> "Is the rule too tied to web/app development to deserve constitutional placement?"

The user phrased the directive as "specifically for web/app development." The proposed §1.5.1 wording uses "user-facing feature" as the trigger, which captures the web/app context without excluding adjacent surfaces (API endpoints with downstream consumers, agent-side workflows, etc.). The principle is: *trace the operational context, not just the technical context, before building*. That generalizes; the web/app case is the most common instance.

The proposal survives the outside-view read.

## Proposed change

Append the following sub-clause to **§1.5 Organic + Holistic Solutioning** in CLAUDE.md, immediately after the existing bullets:

```
### 1.5.1 Feature-workflow precondition gate

> Added by AMD-006, ratified 2026-06-17.

Before building any user-facing feature, trace four things:

1. **Why it's built** — the unmet need the feature addresses.
2. **Where it sits** — its location in the broader system architecture
   (which layer, which data flow, which adjacent features).
3. **The user's workflow shape** — what the user does *right before*
   invoking this feature, and what they intend to do *right after*.
4. **Continuity** — whether the completed feature leaves the user in a
   flowing state (next action obvious, system ready for it) or stalls
   them (empty state, dead end, unnecessary intermediate steps).

A feature that is technically complete (the code works, the data
changes, the API returns 200) but operationally isolated (works in
itself but breaks workflow continuity) is incomplete and must not ship.

This gate exists because §1.5 alone covers system-level interconnection
("does this break other code?") but not workflow-level interconnection
("does this leave the user able to continue?"). The Close-without-auto-
advance incident (2026-06-17, commit d9523a0) demonstrated that a
feature can pass every system check and still break the operational
reality it lives inside. The constitutional defense is the precondition:
trace the workflow before building, not after the user reports the gap.

The principle generalizes beyond web/app — any feature whose operation
involves a sequence (user, caller, downstream consumer) requires
tracing that sequence's continuity, not just the feature's internal
correctness. For web/app development specifically, this means the
user's click-by-click workflow.
```

Add the following item to **§6 Quick Decision Checklist**, immediately after item 5 of the existing list:

```
**5a. (Added by AMD-006, ratified 2026-06-17.)** For user-facing
features: have I traced the user's workflow before AND after this
feature, and does the feature leave them in a flowing state? Or
does it stall them — empty state, dead end, unnecessary intermediate
steps?
```

(Renumbering of subsequent items is not required; checklist items are
discriminated by content, not number.)

## Decision

`ratified` 2026-06-17.

Ratification: founder directive ("from now on add this as an ammendment rule specicially for web/app developement every system built needs to have a complete understanding of why it is built…"). The §1.5.1 sub-clause and §6 item 5a are applied to CLAUDE.md in the same commit that creates this file, per §7.4 ("any edit must reference its amendment by ID in the commit message").

Per §7.5 distrust-of-evolution remains in effect: if AMD-006, after some period of operation, produces measurably worse outcomes than the rule it replaced (e.g., the feature-workflow gate is invoked falsely often enough to materially slow shipping without correlating to fewer workflow breaks), it is itself eligible for a counter-amendment. The constitution is not a one-way ratchet.
