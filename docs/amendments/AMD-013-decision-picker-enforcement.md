# AMD-013 — Every founder-decision is a picker, enforced by a Stop-hook gate

- **Status:** RATIFIED (founder-directed, 2026-08-22)
- **Ratified:** 2026-08-22
- **Author:** Claude Code agent, at the founder's explicit instruction
- **Type:** Structural-gap fill (new enforcement for an existing behavioral rule)

---

## Trigger (evidence — §7.2.1)

The rule "present every founder-facing decision as an `AskUserQuestion` picker with a recommendation, never
as prose" is already documented in the agent's standing memory (`feedback_option_based_decision_control`,
built 2026-08-09, re-emphasized 2026-08-15). It failed AGAIN, repeatedly, on 2026-08-22:

1. After shipping the DoorLog capture-loss fix, the agent presented the "what next" decision as a PROSE
   numbered list ending "which way do you want me to go?" — not the picker.
2. The founder, in caps, twice: *"PLEASE ALWAYS GIVE ME A PICKER OPTION ALONG WITH YOUR RECOMMENDED
   SUGGESTION FOR ALL DECISIONS… I HAVE ASKED THIS MULTIPLE TIMES"* and *"ALL DECISION RELATED GATED ELEMENT
   NEEDS TO BE PRESENTED TO ME VIA A PICKER OPTION ALONG WITH YOUR RECOMMENDATION."*
3. The founder then asked whether the agent could be trusted not to repeat it, and directed: if the answer is
   anything but yes, *"AMEND OUR SYSTEM AND CREATE A SYSTEM THAT WE CAN IMPLEMENT TO AVOID YOU FROM EITHER NOT
   GIVING ME A ITEM/DECISION SELECTION PICKER USER INTERFACE, OR UNDERMINING ANY OF MY REQUEST."*

The honest answer is NO — the agent cannot guarantee it on memory/intent alone, because it has now failed
while the rule was documented. That is the evidence this amendment rests on.

## Diagnosis — WHY the existing (behavioral) rule produced wrong behavior (§7.2.2)

This is the A22 failure shape ("the citation mechanism runs at the speed of language; the re-reading mechanism
runs at the speed of attention; they drift apart") applied to a behavior instead of a citation: **the rule
lives in memory, but memory does not fire at output-generation time.** Under output pressure — especially the
A23 build-guard's "keep going" — the lowest-effort output is a prose summary that ends by offering choices in
words. The picker requires an active, deliberate recall that the prose path bypasses. A rule enforced only by
"remember to" is exactly the class A30 names: *a lesson recorded only in prose will return; a fix is not
complete until the class is encoded in a GATE that fails without the author's cooperation.* Three recurrences
prove the behavioral layer is insufficient.

## The rule this amendment adds

Added to CLAUDE.md §6 (Quick Decision Checklist), citing this amendment:

> **0. (AMD-013.)** Is this output offering the founder a DECISION — a choice among courses, or asking them to
> pick/approve/direct? If so it MUST be an `AskUserQuestion` picker WITH a recommendation (recommended option
> first), NEVER a prose option-list, "which do you want?", "should I X or Y?", "want me to…?", or "your call".
> A prose choice at a decision point is the §3.3 overtake failure inverted — it under-serves the founder's
> control — and is forbidden. This is enforced by `.claude/hooks/decision-picker-guard.mjs`.

## Enforcement mechanism (the structural gate)

`.claude/hooks/decision-picker-guard.mjs` — a **Stop hook** (registered in `.claude/settings.json` alongside
the A23 build-continuation guard). On every stop it reads the transcript tail, extracts the agent's FINAL
user-facing text and whether an `AskUserQuestion` tool call fired this turn, and **BLOCKS the stop** if the
final text offers the founder a choice in prose while no picker was fired. The block reason directs the agent
to re-present as a picker (or, if it was genuinely not a decision, to rephrase out the choice-offering
language). It fails OPEN on any error (never breaks the session) and reads only the tail (never loads the full
transcript). Detection is high-precision: verified that all six real decision-offering phrasings (including the
agent's actual 2026-08-22 lapse) trigger, and six legitimate reports (including one containing "I recommend…")
do not.

## Soundness gate (§7.2)

1. **Triggered by evidence.** ✓ Three documented recurrences 2026-08-22 + the prior 2026-08-09 / 2026-08-15
   incidents.
2. **Diagnosed, not preferred.** ✓ The behavioral rule can't fire at output time (A22 shape); needs a gate (A30).
3. **Ripple-traced.** ✓ Touches §6 (adds a checklist item), the `feedback_option_based_decision_control` memory
   (updated), and `.claude/settings.json` (adds a second Stop hook). It composes cleanly with the A23
   build-continuation guard — orthogonal concerns (one blocks self-authorized stopping during a build; this one
   blocks stopping with an un-pickered decision). No §-contradiction: it strengthens §3.3 (guide, don't
   overtake) and §5 (builder-under-pressure) rather than conflicting with any rule.
4. **Alternative-tested.** ✓ The gate outperforms the prose rule on the triggering incidents: the hook, run
   against the agent's actual prose-lapse text, BLOCKS it — the behavioral rule did not.
5. **Outside-view checked.** ✓ A reader with no stake sees a genuine forcing function that ADDS friction to the
   builder (blocks its stops) to protect the founder's control — not a builder convenience.
6. **Does not soften under pressure.** ✓ It is strictly more constraining on the agent, never less.

## Distrust-of-evolution note (§7.5)

If, in operation, this gate produces material false-blocks that impede legitimate reporting (an over-broad
detector), that is grounds for a counter-amendment tuning the detection — NOT for removing the enforcement.
The cost of a false block is low by design: the fix is to fire a picker (never wrong at a decision) or to
rephrase a non-decision, both cheap.
