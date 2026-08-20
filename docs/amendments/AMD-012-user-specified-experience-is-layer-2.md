# AMD-012 — A user-specified experience/design property is layer-2 (the intended result), not layer-4 (waivable polish)

- **Status:** RATIFIED
- **Proposed:** 2026-08-20
- **Ratified:** 2026-08-20
- **Amends:** §1.5.1 (four-layer feature-workflow gate) — adds §1.5.4; adds §6 checklist item 5d.
- **Asset:** ThinkerThinker.md A42.

---

## Triggering incident (§7.2.1 — evidence)

**The schedule Print/Download under-delivery, 2026-08-20.** The founder asked, in their own
words, for print and download features that "need to have a graphic element that is very easy to
understand," and — after the first cut — restated it: *"it very plain, and does not have visual
graphic element that makes it easier to read it. It needs to have colors elements, design
concept/element that accomplish my original request. Why did you ignore my instruction?"*

The agent built a **correct** export — the whole schedule, every staff member, every shift,
rendered to a clean image, deploy-verified — but **monochrome**: a plain black-on-white table with
no color-coding, no legend, no design that makes the schedule readable at a glance. The agent
reported it as done. The visual/graphic character the founder had **explicitly named as the
requirement** was absent, and the agent had filed that absence under "layer-4 polish that can
follow."

The founder escalated to the meta-level: *"This make me question how often you disregard my
instruction and overtake, or under-deliver,"* and directed a constitutional amendment: *"amend
[the reasoning system] and [the constitution] to make sure we don't encounter this problem once
again. This is a major mistake not a small one, if this keeps happening it will [compound]."*

## Diagnosis (§7.2.2 — why the existing rule produced wrong behavior, from the record)

§1.5.1 classifies "user interface and design" as **layer 4**, and states: *"A feature that passes
layers 1-3 but fails layer 4 can ship with a follow-up polish commit."* The agent applied that
clause literally: design is layer 4 → the missing design is deferrable polish → ship and report
done.

The error is a **category-vs-requirement confusion**. The four-layer framework assigns a layer to a
concern **by its category** (structure=1, effectivity=2, composition=3, design=4). But the layer at
which a property is *binding* is not fixed by its category — it is fixed by **whether the user made
it part of the intended result**. Layer 2 asks: *"does the feature deliver the intended result?"*
When the user specifies the experience or appearance **as** the deliverable ("it needs colors, a
design concept, a graphic element that's easy to read"), that specified experience **is** the
intended result — it belongs to layer 2, not layer 4. Layer 4's discretion ("ship now, polish
later") was written for design decisions the **agent originated** — the thousand small choices no
one specified. The rule as written carries **no term** distinguishing agent-originated design (truly
discretionary) from user-specified design (a stated requirement), so the "follow-up polish" clause
silently waived an explicit instruction. The result is the §5 signature: a confident, well-formed,
correct-looking deliverable reported "done" with a stated requirement unmet.

This is the same structural shape as A20 ("founder decision needed" = substituting the agent's
quality bar for the founder's) and A41 (layer-2 read as "the code path works" and stopped short of
"it actually works"): each is the agent reading a layer's scope too narrowly and letting a real
requirement fall through the gap the narrow reading opened.

## Ripple trace (§7.2.3 / §1.5)

- **§1.5.1** — extended, not contradicted. The four layers and their sieve order are unchanged. The
  amendment adds a rule for **which layer a property binds at** when the user has specified it,
  closing the category-vs-requirement gap. Added as **§1.5.4**.
- **§6 checklist** — adds item **5d**: "Did the user specify the experience/appearance as a
  requirement? If so it is layer-2 (the result), not layer-4 (polish) — it cannot be deferred."
- **§5** — reinforced. Reporting "done" with a user-specified requirement unmet is exactly the
  confident-well-formed-failure §5 names; this amendment gives it a named precondition check.
- **§3.3 (guide, don't overtake)** — adjacent but distinct. Overtaking is doing *more/other* than
  asked; this failure is doing *less* than asked while reporting complete. The amendment names the
  under-deliver half explicitly so both halves of "respect the founder's stated intent" are covered.
- No section is softened or removed. No silent contradiction introduced.

## Alternative-tested (§7.2.4)

On the triggering incident: the **existing** rule permitted shipping the monochrome export as done
(design = layer 4 = deferrable). The **new** rule blocks it: the founder named color/design/graphic
as the requirement, so it is layer 2, so "done" is false until it is met. The new rule strictly
outperforms the old one on the incident, and on the class it generalizes (any feature where the
user specified the look, feel, tone, format, or interaction *as* the ask).

## Outside-view (§7.2.5)

A reader with no stake agrees that "design is layer 4, therefore optional" is a **category error**
when the user made the design the point of the request. The amendment survives the detached reading:
it does not privilege the builder; it removes a loophole the builder used.

## Does not soften under pressure (§7.2.6)

The amendment **adds** friction for the builder — it forbids deferring a user-specified experience
as "polish," which is precisely the shortcut the builder-under-pressure reaches for to report
completion sooner. It improves outcomes for the founder (they get what they asked for) at a cost to
the builder (cannot call it done early). This is the correct direction under §5.

---

## Resulting constitutional text

Adds **§1.5.4** to CLAUDE.md and item **5d** to the §6 checklist. See the CLAUDE.md diff in the same
commit (referenced by this amendment ID per §7.4).

## Status log (append-only, §7.3)

- 2026-08-20 — PROPOSED and RATIFIED same day. Triggered by a documented incident (the schedule
  export under-delivery) with the founder's direct escalation and amendment directive on the record.
  All six §7.2 soundness checks pass. Encoded in CLAUDE.md §1.5.4 + §6.5d and ThinkerThinker.md A42.
