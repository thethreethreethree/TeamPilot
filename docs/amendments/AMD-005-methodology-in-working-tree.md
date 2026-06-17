# AMD-005 — Methodology that governs the build must live in the agent's working tree

- **Status:** ratified
- **Date proposed:** 2026-06-17
- **Date ratified:** 2026-06-17
- **Proposed by:** agent (draft for ratification), triggered by CAT-001 catastrophic event 2026-06-16
- **Ratified by:** founder directive ("I ratify AMD-005")
- **Affects:** CLAUDE.md §0 (The One Law) — adds §0.1 precondition gate; CLAUDE.md §6 Quick Decision Checklist — adds item 1a; ThinkerThinker.md A19 (the source asset already on record).

---

## Trigger

Catastrophic event **CAT-001** (2026-06-16) — recorded in
[`docs/catastrophic-events/CAT-001-methodology-store-outside-tree-2026-06-16.md`](../catastrophic-events/CAT-001-methodology-store-outside-tree-2026-06-16.md).

The agent operated for approximately six weeks of sustained C.A.R.E build work
(Sprints 1 through 7) from CLAUDE.md + the four ratified amendments + conversation
context — but NOT from ThinkerThinker.md, the methodology asset library containing
A1–A18. ThinkerThinker.md existed in the user's IP store outside the repo. The
agent had a memory note saying "ThinkerThinker.md is sensitive IP, kept externally"
and read that as *permission to operate without it* rather than *requirement to
fetch it before substantive action*.

Result, as documented in CAT-001 + the C.A.R.E asset audit
([`docs/CARE-ASSET-AUDIT-2026-06-16.md`](../CARE-ASSET-AUDIT-2026-06-16.md)):

- 7 P0 structural violations of the asset library baked into shipped code (A6, A8,
  A11, A13, A14, A16, A17)
- Citations of "§A11", "§A18", etc. appearing in commit messages and source
  comments while the underlying assets were never actually consulted — the agent
  had the *labels* without the *content*. This is the canonical §5 "knowledge ≠
  intelligence" failure mode embedded structurally rather than behaviorally.
- The user surfaced the failure after multiple invocations of constitutional
  language ("we are breaking the constitution's law") had failed to surface it
  from agent-side self-detection. The structural fix the user applied — moving
  ThinkerThinker.md directly into the repo — is what made the discipline
  re-detectable.

The triggering incidents are bounded and well-documented. The pattern is
**explicitly post-hoc** (caught only after sustained damage), not pre-emptive.
Per A14's lesson-about-the-lesson, this is exactly the failure shape the agent's
own loop-detection has historically been bad at.

## Diagnosis

The existing §0 ("Understanding precedes solving. Always. No exceptions.") is
*behaviorally* correct but *structurally* incomplete. It assumed the methodology
defining "understanding" for the domain was accessible to the agent. When that
assumption silently failed — as it did for ThinkerThinker.md — §0 could be passed
by **feeling-confident-from-cached-labels** rather than by
**consulting-the-source**. The rule held; the precondition the rule depended on
did not.

The behavioral fix ("I will consult ThinkerThinker.md from now on") is exactly the
A9 failure the constitution warns about — "the builder's submission to the
discipline IS the product's credibility." Memory-dependent fixes don't survive
context loss, model swaps, or agent runs that start cold. Per CAT-001's own §1.2
retrospective: the user invoked the constitution multiple times during the
six-week window with no agent-side discipline shift. Verbal reminders did not
hold; only the structural move (file moved into repo) closed the loop.

What §0 was missing is a **precondition gate**: the methodology document defining
"understanding" for the work at hand must be in the agent's working tree before
substantive action proceeds. This is the same shape of structural lock-in A12
applies to migrations ("the lesson has to live somewhere the next author will
encounter before authoring") extended to the methodology layer itself.

## Ripple-trace

This amendment is constitutional rather than asset-level (A19 already exists in
ThinkerThinker.md as the captured asset; this amendment elevates the gate to §0
sub-clause status so it has constitutional weight per §7.4).

Sections of CLAUDE.md affected:

| Section | Effect | Coherence check |
|---|---|---|
| **§0 The One Law** | Adds a precondition gate clause: "understanding precedes solving" requires the methodology defining "understanding" for the domain to be in the agent's working tree. | The existing prose stays intact. The amendment is additive — it makes explicit what §0 always required. |
| **§1.1 Data-as-Asset** | Reinforced. The methodology asset library IS data-as-asset; the amendment makes its accessibility a §0 precondition rather than an unwritten assumption. | No conflict. |
| **§5 Standing Principles** | Reinforced. §5 names the "knowledge ≠ intelligence" failure mode (fast confident answers imitating understanding). The amendment closes the structural avenue this failure mode used to slip through. | No conflict. |
| **§6 Quick Decision Checklist** | Adds a new item: "Is the methodology document for this domain in the working tree, and have I read the relevant asset(s) this session?" | Net additive; doesn't loosen existing checklist items. |
| **§7 Amendment Process** | This amendment exercises §7. The process itself confirms the amendment by being followed. | Self-coherent. |

Sections of ThinkerThinker.md affected:

- **A19** is the originating asset (captured 2026-06-16 in TT.md). This amendment
  is its constitutional elevation, not a replacement. A19 remains in TT.md as the
  asset; AMD-005 adds the §0 gate that operationalizes it.
- **A12, A14, A16, A17, A18** (the structural-discipline assets) all share the
  meta-shape A19 generalizes. None contradicts this amendment.
- **A9** (the builder's submission IS the product's credibility) is the *reason*
  this amendment is structural rather than behavioral. Coherent.

No silent contradictions introduced. The amendment closes a gap rather than
re-opening one.

## Alternative-test

This is a **structural-gap-filling** amendment per §7.2 — it codifies a rule that
was implicit in §0 + §1.1 but never enforced as a precondition. The "alternative
to test against" is the existing §0 prose alone, which was the operating rule
during CAT-001 and demonstrably failed to prevent the catastrophic event.

The triggering incident (CAT-001) IS the alternative-test:

- **Existing rule (§0 alone):** the agent operated under §0 for six weeks, citing
  it in commit messages, and still produced the catastrophic event. Six weeks of
  evidence the rule alone is insufficient when its precondition fails silently.

- **Proposed rule (§0 + precondition gate):** the precondition gate would have
  surfaced the missing ThinkerThinker.md on the very first substantive action of
  the C.A.R.E build. The agent's first `find` over the repo would have returned
  no result; the §0 gate would have triggered an explicit escalation to the user
  ("the methodology source for this domain is not in the working tree — should I
  request it, or proceed under reduced confidence?"). The user would have placed
  TT.md in the repo at week 1 instead of week 6. The seven P0 structural
  violations and their downstream rebuild cost would not have occurred.

The structural fix the user applied (moving TT.md into the repo on 2026-06-16)
demonstrates the proposed rule's necessary precondition is achievable. The
amendment makes that precondition *required* rather than *fortunate*.

## Outside-view check

Read by a stance with no investment in the amendment passing:

> "This is the agent proposing an amendment that protects the agent's own
> discipline. Is it self-serving?"

The amendment is constitutional weight on the agent's behavior, not relief for
the agent's convenience. The proposed §0 sub-clause REQUIRES the agent to escalate
when methodology is missing — a harder discipline than "operate as best as
possible without it." It cannot be passed by feeling-confident-from-labels; the
gate is the `find` over the working tree, not the agent's self-report. The
amendment makes it structurally harder to ship without proper grounding, not
easier.

> "Could this be invoked to slow shipping for false reasons — e.g., the agent
> claims methodology is missing when it isn't, to dodge work?"

Possible but bounded. The gate's evidence is the working-tree state, which is
objective and verifiable. False invocation would surface as: agent claims
methodology missing → user runs `find` → file present → agent's claim is
demonstrably wrong on the record. The risk is symmetric to false invocation of
any §0 escalation (§1.7 audit findings, §1.5 ripple-trace gaps, etc.) and the
record's permanence makes systematic abuse self-defeating.

> "Is the amendment proportionate to the trigger?"

CAT-001 is classified catastrophic — the project's thesis-falsifying failure
mode if it occurred in a customer's deployment. The remediation cost is the seven
P0 reframes documented in the audit (Phases 0–8 of the post-CAT-001 rebuild,
nine weeks of commits). A constitutional sub-clause adding one pre-flight check
is materially smaller than the cost the event imposed; proportionate.

> "Does the amendment loosen the constitution under pressure (§5)?"

It tightens. §5 names the failure mode where shortcuts under pressure soften
the discipline; AMD-005 is the inverse — it adds a precondition that makes
shortcut-via-cached-labels structurally harder. Passes the §5 check.

The proposal survives the outside-view read.

## Proposed change

Append the following sub-clause to **§0 The One Law** in CLAUDE.md, after the
existing prose (which remains unchanged):

```
**Precondition gate (added by AMD-005, ratified 2026-06-17 if accepted).**
"Understanding precedes solving" requires that the methodology defining
*understanding* for the work at hand be in the agent's working tree at the
moment of action. The agent's first action in any substantive build is to
verify the relevant methodology document is present (e.g.,
`find . -iname "<methodology-doc>"`). If the document is missing, the agent
escalates explicitly before proceeding ("the methodology source for this
domain is not in the working tree — should I request it, or proceed under
reduced confidence?"). Citing labels from a methodology document not in the
working tree is the §5 "knowledge ≠ intelligence" failure mode and is
forbidden.

This gate exists because CAT-001 (2026-06-16) demonstrated that §0 alone,
without an explicit precondition gate, can be passed by feeling-confident-
from-cached-labels rather than by consulting-the-source. The structural
defense — methodology in the working tree — must be a *required*
precondition, not a fortunate one.
```

Add the following item to **§6 Quick Decision Checklist**, between item 1 and
item 2 of the existing list:

```
**1a.** Is the methodology document for this domain in the agent's working
tree, and have I read the relevant asset(s) this session — not relied on
cached labels?
```

(Renumbering of subsequent items is not required; checklist items are
discriminated by content, not number.)

## Decision

`ratified` 2026-06-17.

Ratification: founder directive "I ratify AMD-005" (2026-06-17). The §0.1
precondition gate and §6 item 1a were applied to CLAUDE.md in the same commit
that updated this file's status, per §7.4 ("any edit must reference its
amendment by ID in the commit message"). Status is appended above; the prior
`proposed` state remains in git history per §3.1 append-only.

Per §7.5 distrust-of-evolution remains in effect: if AMD-005, after some period
of operation, produces measurably worse outcomes than the rule it replaced
(e.g., the precondition gate is invoked falsely often enough to materially slow
substantive work), it is itself eligible for a counter-amendment. The
constitution is not a one-way ratchet.

## Notes for ratification

Per §7.4: "The text of this constitution may only be modified as the consequence
of a ratified amendment. Any edit must reference its amendment by ID in the
commit message."

The CLAUDE.md edit is NOT applied in this commit. This commit ships only the
amendment proposal. If ratified, a follow-up commit will:

1. Update the status above from `proposed` to `ratified` with the ratification
   date
2. Apply the proposed change to CLAUDE.md
3. Reference AMD-005 in the commit message

Per §7.5 distrust-of-evolution: if this amendment, after some period of
operation, produces measurably worse outcomes than the rule it replaces (e.g.,
the precondition gate is invoked falsely often enough to materially slow
substantive work), it is itself eligible for a counter-amendment. The
constitution is not a one-way ratchet.
