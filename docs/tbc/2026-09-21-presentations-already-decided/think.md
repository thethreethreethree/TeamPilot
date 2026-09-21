---
started_at: 2026-09-21T16:00:00+08:00
trigger: Wiring the last uncalled aggregate export led into doorlog.ts, where the "open decision" I had recorded turned out to have been settled three months ago — by a reversal, on evidence, after it broke the founder's own home screen.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the question that had already been answered

## Why (the record)

The reachability gate's residual named three exports still uncalled inside a now-green file:
`countPresentations`, `computeActivityKpis`, `sumTeamTotals`. Wiring them needs doors knocked and
sold, which means the door log — so I opened `src/lib/data/doorlog.ts`.

Its `getAllTimeKpi` carries this, in a docblock:

> *"A 'presentation' = a door where the rep SPOKE TO SOMEBODY: doors_knocked − no_answer.*
> *THIS REVERSES A PRIOR DECISION… Founder's decision 2026-09-11, taken with those numbers in
> front of them."*

My `countPresentations`, written two days ago from the build guide, defaults to **recorded
pitches** and documents the choice as the guide's *"Open decision #1 — confirm with John before
building."*

John confirmed. On 2026-09-11. Three months after the guide was written, in production, with
numbers in front of him — and what he confirmed is the opposite of the default I shipped.

## It is a reversal, which is what makes it binding

On **2026-08-28** the founder *did* choose recorded pitches, checked against one rep: 41 recorded
against 46 non-no-answer knocks. At a five-door gap the sharper measure was plainly better, and
that reasoning was right when it was made.

The gap did not hold. Measured **2026-09-11**: the same rep was 126 spoken-to against 50
recorded, and the founder's own row read 18 spoken to, 3 recorded, and **10 sold** — a close rate
of 333%, because sales are counted from knocks and the denominator was being counted from audio.
It reached their home screen as *"0 of 9 PRESENTATIONS"* beside *"9 of 1 SOLD"*.

Sold exceeding presentations is not a definition preference. It is a broken denominator.

## What I actually got wrong

Not the arithmetic. The guide was not incorrect either — it was **old**. It asked a question that
had since been answered, and the answer was in the working tree, in the file that owns the data.

Treating a written *"confirm this"* as still-open without checking the record is §0.1 exactly:
the methodology defining the answer was present at the moment of action and was not consulted. I
recorded an open decision in the contradictions register and built a default around it, when the
honest move was one grep away.

There is a second-order lesson worth stating plainly: **flagging something as open is not a
neutral act.** It looks like the careful choice — noting rather than assuming — and it produced a
default the founder had already reversed, with the flag lending it the appearance of diligence.
Marking a question open when it is closed is a wrong answer wearing the costume of a right one.

## The cost, had it shipped

The Pitch Score boards and the Door Log's own KPI bubbles would have shown **different
presentation counts for the same rep on the same day, in the same product**. Two definitions of
one decision (§2.2), one per screen — and the Pitch Score side would have been the definition the
founder had already thrown out for producing impossible close rates.

Nobody would have got an error. Both screens would have looked right on their own.

## What changes

`countPresentations` defaults to `doorsSpokenTo` and carries the decision, the reversal, and the
numbers that forced it. The switch survives — the founder has changed this once on evidence and
may again, and a definition that took two attempts should stay one argument from changing.

Two tests pin it, and the second is the one that matters: it **reproduces the 333% close rate**
under the old default using the founder's own figures, then asserts the corrected definition
cannot exceed 100%. The defect is in the suite rather than only in a comment.

## Layers (§1.5.1)

1. **Structure** — the definition still lives in one named function, which is the only reason
   this correction is a body change and not a hunt.
2. **Effectivity** — the corrected definition now matches the door log's, so the two surfaces
   cannot disagree.
3. **Composition** — nothing consumes the KPIs yet; that is the Today's Metrics board and remains
   unbuilt. This build makes the number correct *before* anything renders it.
4. **Surface** — none.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving; understanding must be EARNED, never assumed because an answer arrived quickly and sounded right.",
    "how_this_build_will_embody_it": "The guide's 'open decision' sounded right and was cheap to accept. Earning it meant reading the file that owns the data, which took one grep and reversed the answer." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The methodology defining the work must be in the working tree AND consulted at the moment of action; leaning on labels from a document not consulted is the §5 failure and is forbidden.",
    "how_this_build_will_embody_it": "The governing clause. The founder's decision was in the tree, in doorlog.ts, with its evidence — and I built from a guide that predates it. §0.1 is usually read as 'is the doc present'; this is the other half: present and NOT READ is the same outcome." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-09-21T16:05:00Z",
    "why_it_governs": "Identify problems by looking BACKWARD at the actual record — logs, prior commits, past failures — not by theorising forward.",
    "how_this_build_will_embody_it": "The record settled it and the theory did not. The 2026-08-28 choice was defensible reasoning; the 2026-09-11 measurement overturned it. Reading the record is the whole of this build." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Examine it as a detached observer with no stake in the existing assumptions or sunk cost.",
    "how_this_build_will_embody_it": "The sunk cost here was mine and two days old — a function, a test, and a register entry all built around the question being open. The outside reading is that a 333% close rate settles it regardless of what I had written." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — never fix one thing in a way that silently breaks another; trace ripple effects before acting.",
    "how_this_build_will_embody_it": "The ripple IS the finding: two surfaces would have disagreed about one number, in one product, with no error on either." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Layer 2 asks whether the feature delivers the intended RESULT, not whether the code path runs.",
    "how_this_build_will_embody_it": "The old default's code path was perfect. It computed a real number that was the wrong number, which is the distinction layer 2 exists to draw." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first about what could be wrong, then search to confirm; the agent audits adjacent surfaces as it works rather than only when asked.",
    "how_this_build_will_embody_it": "The finding came from opening an ADJACENT file — the door log — to get a number, not from auditing aggregate.ts. The clause's claim that a bug rarely lives alone held in the other direction: the answer rarely lives where the question is." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-190", "read_at": "2026-09-21T13:55:00Z",
    "why_it_governs": "A feature depending on something outside the code it lives in is not complete until that dependency is verified; silent dependence is the defect.",
    "how_this_build_will_embody_it": "Its exact analogue for a DECISION rather than config: the KPI depended on a definition living in another module, and depending on it silently — by guessing from a guide — is the same failure shape." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T13:25:00Z",
    "why_it_governs": "The layer at which a property binds is set by whether the user made it part of the intended result, not by the property's category.",
    "how_this_build_will_embody_it": "Bears more than it first appears. The founder specified this definition, twice, the second time with measurements — so it is the intended RESULT, not an implementation preference a default could stand in for." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-280", "read_at": "2026-09-21T13:52:00Z",
    "why_it_governs": "Diagnose before patching: read the relevant history and state the root cause before proposing a change.",
    "how_this_build_will_embody_it": "The history WAS the diagnosis. Both the 2026-08-28 choice and the 2026-09-11 reversal were read before anything changed, which is why the fix keeps the switch rather than hard-coding the current answer." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Data-as-asset and append-only: past resolutions are reusable material, and nothing is discarded.",
    "how_this_build_will_embody_it": "The 2026-08-28 reasoning is kept in the corrected docblock rather than replaced, because it was right when it was made — and the register entry is corrected in place with the correction marked, not deleted." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T13:26:00Z",
    "why_it_governs": "Guide, do not overtake; surface and explain rather than silently rewriting, and never take a decision that is the human's.",
    "how_this_build_will_embody_it": "The correction does not TAKE a decision — it stops taking one. The default was the agent standing in for the founder on a question they had already answered; the fix hands it back to the record." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-394", "read_at": "2026-09-21T14:50:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "Its inverse: a metric the user CAN perceive, computed from a definition they reversed, is worse than stagnation — it is visible motion in the wrong direction, and they would have had to catch it twice." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-21T15:55:00Z",
    "why_it_governs": "A method counts as learned only when measured against the alternative on real problems with before/after rigor; the System must distrust its own evolution until results prove it.",
    "how_this_build_will_embody_it": "This is the clause working correctly, for once, and at the FOUNDER's hands rather than the agent's. The 2026-08-28 definition was a plausible method; real data on real reps overturned it within two weeks. The reversal is §4 in practice." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "One decision, one source; duplicated conditions drift and the drift is invisible.",
    "how_this_build_will_embody_it": "Two definitions of 'presentation' in one product is this clause at the level of a BUSINESS definition rather than a code condition — and it would have drifted from the moment it shipped, not eventually." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible.",
    "how_this_build_will_embody_it": "A close rate above 100% is the opposite of defensible, and it is what the reverted definition produced on the founder's own row. Close rate is one of the two hard metrics." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "'The guide says it is open, so it is open' is a fast, well-sourced, confident answer. It was wrong because the source had an expiry date nobody had checked." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "Item 1a — is the methodology in the tree, and have I read the relevant asset THIS SESSION rather than relying on cached labels?",
    "how_this_build_will_embody_it": "The checklist item that would have caught this two days ago, applied to a decision record rather than to a constitution clause." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Holding the labels without the content produces work written in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "The register entry cited the guide's open-decision number and stated the provenance carefully — the full vocabulary of rigour, wrapped around an answer that was three months stale." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "Its sibling case: not a constitutional citation from memory, but a PRODUCT decision taken from a document without checking whether the record had moved past it." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A lesson in prose returns; encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The 333% close rate is now a test that reproduces it under the old default. A comment saying 'do not use recorded pitches' would have been the prose that returns." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual is the highest-yield queue in the audit.",
    "how_this_build_will_embody_it": "Eighth consecutive build from the previous residual, and the highest-yield one yet: R4 was a note about file-level granularity, and following it found a shipped wrong definition." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a command you ran.",
    "how_this_build_will_embody_it": "The founder's decision was verified by reading the two functions that implement it, not by trusting the docblock that announces it." }
]
```
