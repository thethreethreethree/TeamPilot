# AMD-004 — Ground-up audit as a constitutional practice

- **Status:** ratified
- **Date:** 2026-06-02
- **Proposed by:** founder directive ("add this to ThinkerThinker, since most companies will need this type of approach when it comes to developing their strategy")
- **Affects:** CLAUDE.md (adds §1.7 "Ground-up audit"); affects §1.2 (Retrospective Identification) by complementing it with a structural-foundation variant.

---

## Trigger

In-session demonstration of the practice. A ground-up audit was being conducted on
this codebase (walking from toolchain → boundaries → schema → API → discipline →
presentation, flagging weaknesses at each layer) when the founder directed that the
practice itself be encoded constitutionally because "most companies will need this
type of approach when developing their strategy."

The current constitution covers §1.2 Retrospective Identification (looking backward
at *incidents and decisions* in the record) but has no explicit rule for periodically
walking the *foundation* of the system from its simplest layer up through its most
critical one. This is a structural gap that the founder's directive surfaces and
fills.

## Diagnosis

Without a ground-up audit discipline, the constitution evolves elegantly at the top
while leaving the bottom unverified. Specific failure modes the current rules do not
prevent:

- **Top-heavy validation.** Dialogues, decision flows, and rituals get tested through
  use. Foundation layers (env validation, type boundaries, schema invariants, RLS
  scoping, error handling) only get checked when they break visibly. By then the
  damage is already in the audit trail.
- **Confidence laundering.** A system that produces correct-looking output at the
  surface can have unsound foundations — the surface output is treated as evidence
  that the foundation is fine, when it is only evidence that today's specific surface
  call worked. This is the §0 failure mode applied to the architecture itself.
- **Amendment myopia.** AMD-001 through AMD-003 are each well-scoped to a specific
  rule. The constitution has no mechanism for the systemic review that would catch
  an issue spanning several layers (e.g. "the brain layer is sound, the LLM layer is
  sound, but their composition under demo mode has a hole").
- **First-time-builder blindness.** A team building strategy or a system for the
  first time will produce a top layer that *looks* like established practice but is
  sitting on a foundation no one verified. Most companies developing strategy from
  scratch suffer this exact failure — confident-looking strategy documents resting
  on unexamined assumptions about market, team, and product. The audit practice is
  the structural defense.

Root cause: the constitution describes *how to think* about problems but not *how to
verify the system that does the thinking*.

## Ripple-trace

- **§1.2 (Retrospective Identification).** Complemented, not contradicted. §1.2 looks
  backward at incidents; §1.7 walks the foundation. Together they cover both
  "what did we do" and "what are we sitting on." Coherent.
- **§1.3 (Outside-Perspective Identification).** §1.7 explicitly requires the
  outside-view stance during the audit — the auditor reads their own work as if it
  were someone else's. Reinforces §1.3 rather than overlapping it.
- **§3.1 (Events are immutable).** Audit findings should be recorded as their own
  events (an "audit:layer-N" event log) so the audit history itself is immutable.
  Not strictly required by this amendment but recommended for future ones.
- **§4 (Evolving the Method).** A ground-up audit is one of the things that gates
  method evolution. The rule "validated against alternative" only holds if the
  alternative is known to be sound. The audit is how soundness gets demonstrated.
- **§5 (biggest risk is the builder under pressure).** §1.7 must NOT become a delay
  mechanism. Audits produce flag lists — they do not stop shipping. The protection
  against builder-under-pressure abuse: the audit is *additive* (flags get
  recorded) not *subtractive* (no flag halts work unless the flag itself is a
  blocker, per existing rules).
- **§6 (Quick Decision Checklist).** §1.7 adds a 9th checklist item: "When was the
  last ground-up audit, and what did it flag that remains open?" This makes the
  audit visible at every substantive decision.
- **§7 (Amendment Process).** Audits often surface evidence that justifies new
  amendments. §7 governs how those amendments are ratified. §1.7 is the structural
  source of evidence for §7's soundness gate.

No section is loosened or contradicted.

## Alternative-test

Structural-gap amendment. There is no prior rule to test against. The alternative is
"audits happen ad-hoc or never," which the diagnosis section identifies as failing
the confidence-laundering and amendment-myopia modes.

Comparison metric for future validation (§4): track whether ground-up audits
performed before a major release surface flags that would otherwise have caused
incidents. If audit flags do not predict incidents better than no-audit baselines
after 6+ months of operation, §1.7 is itself eligible for counter-amendment per
§7.5.

## Outside-view check

Read with no stake in adopting:

- Does this loosen the constitution under builder pressure? **No** — it adds
  friction (more work) but produces only flags, not blockers.
- Does it become a process-theater requirement? **Possibly** — audits can degenerate
  into checklists that no one reads. Mitigation: the rule explicitly requires
  honest flags, and an empty flag list is itself a suspicious finding worth
  questioning.
- Does it create a §5 risk (builder under pressure soft-skipping audits)? **Yes** —
  if a builder is under pressure, the temptation is to audit fast and surface only
  what they already know. The mitigation is the outside-view requirement: the
  auditor reads their own work as if it were someone else's, which makes
  shallow-audit harder to perform honestly.
- Does it conflict with shipping fast? **Yes, intentionally** — but per the
  constitution's closing line ("If a rule here ever conflicts with shipping faster,
  the rule wins"), this is acceptable. Speed that skips foundation-checking is the
  failure mode this entire project was built to defeat.

Passes with the named risks flagged for future §7.5 review.

## Proposed change

Append the following to `CLAUDE.md` as a new subsection §1.7, placed at the end of
the existing §1 "Core Method" section:

> ### 1.7 Ground-up auditing
>
> Periodically — and before any major structural change — the system or organization
> must be audited from its simplest foundation up through its most critical layer.
> The audit is a complement to §1.2 (Retrospective Identification): §1.2 looks
> backward at incidents and decisions; §1.7 walks the foundation itself.
>
> The audit must:
>
> 1. **Proceed ground-up.** Start at the most foundational layer (environment,
>    toolchain, types, schema, RLS, data, API, discipline, presentation — in
>    increasing order of complexity and consequence). The order matters: a problem
>    at layer N propagates upward to every layer above it, so flags at the bottom
>    are leveraged more than flags at the top.
> 2. **Be performed in the outside-view stance (§1.3).** The auditor reads the
>    system as if it were someone else's — no investment in defending existing
>    choices.
> 3. **Produce honest flags.** Each layer must surface what is solid, what is
>    flagged, and what is missing — and rate severity. An empty flag list at a
>    layer is itself a suspicious finding worth questioning before acceptance.
> 4. **Be on the record.** The audit and its flags are recorded — ideally as
>    `audit:layer-N` events per §3.1 — so the audit history is immutable and
>    later audits can be compared against earlier ones.
> 5. **Produce flags, not blockers.** Audit findings inform but do not, by
>    themselves, halt work. Existing rules (§3.2 Understanding Gate, §7 Default
>    Deny, etc.) remain the actual blockers. This prevents §1.7 from being abused
>    as a delay mechanism (§5).
>
> The discipline this codifies generalizes: most organizations developing strategy
> for the first time produce a top layer that *looks* like established practice
> but rests on unexamined foundations. Ground-up auditing is the structural
> defense against that failure — both in code, and in strategy work itself.

Additionally, append to **§6 Quick Decision Checklist** a 9th item:

> 9. When was the last ground-up audit of this system or strategy, and what flags
>    from it remain open?

## Decision

**Ratified** — founder directive + soundness gate passed (with the two flagged
risks recorded for §7.5 monitoring).

## Status Update — 2026-06-02

Ratified. CLAUDE.md edited to include §1.7 and §6 item 9. This file is now part of
the canonical record.
