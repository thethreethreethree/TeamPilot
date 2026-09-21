---
started_at: 2026-09-21T16:30:00+08:00
trigger: The previous sweep ended by naming what it could not detect. Looking there found a band table I had duplicated the same day — and the two copies already rendered on one page.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the gap I wrote down, then looked into

## Why (the record)

The record-sweep closed with an honest limit:

> *"What it does NOT cover: decisions the guide states as settled which the product has since
> changed… would carry no flag at all and is not detectable by re-reading the register, because
> nothing in the register marks it."*

Writing that sentence is what made the next step obvious. A gap you can describe precisely is a
place you can go and look, and the way to look is not to re-read the register — it is to ask,
for each number the new system prints, whether the product already prints that number somewhere.

The first one I checked was the score band. It took one file.

## What was there

`src/lib/coach/gamification/bands.ts` — the tested single source of truth, with a docblock that
says, without ambiguity:

> *"nothing re-derives these values (§2.2 — a duplicated band boundary would drift)."*

`storePitchScore.bandFor` re-derived them. I wrote it two days ago and annotated it:

> *"The thresholds are an ASSUMPTION, stated as one: the only evidence available is the mockups
> showing 'Strong' beside 80.3 and 'Solid' beside 77.0."*

The evidence was not only the mockups. It was a file away, in the same `lib/coach` tree.

## The near-miss is the interesting part

| | Authority | My copy |
|---|---|---|
| 90-100 | **Elite** | *absent* |
| 80-89 | Strong | Strong (≥80) |
| 60-79 | Solid | Solid |
| 40-59 | Developing | Developing |
| 0-39 | **Needs coaching** | **Early** |

**The boundaries I inferred were right.** 80, 60, 40 — exactly the authority's lines. Inferring
three numbers correctly from two data points is the kind of thing that makes a copy feel earned,
and it is why both of my tests passed: 80.3 and 77.0 land where the two versions agree.

What I got wrong was the *set*. A band missing at the top, a band renamed at the bottom.

## It was already on one screen

`/dashboard/sales-coach/my-progress` renders the rep Arena — which consumes the authority —
directly above the Pitch Score boards, which consumed my copy. I mounted them together earlier
today.

A 95-point pitch: **Elite** in the gauge, **Strong** in the card beneath it.
A 20-point pitch: **"Needs coaching"** above **"Early"**.

Same rep, same page, same number, two answers. No error on either.

## What the tests were worth

Nothing, against this.

`bandFor(80.3) === "Strong"` and `bandFor(77.0) === "Solid"` are true under both versions. Two
green tests on a function that disagreed with the rest of the product at the top and bottom of
its range — the fixtures-too-clean-to-discriminate failure, in the one place where the correct
values were sitting in a file I could have read.

The new guard asserts agreement at every half-point from 0 to 130. Reinstating the old copy fails
three tests; before the guard, it failed none.

## Third time today

| | The duplicate | Agreed when written? |
|---|---|---|
| manager predicate, calibration route | `ctx.isAdmin \|\| sales_coach_role === "admin"` | yes |
| `lowestSectionId`, Breakdown board | identical four lines | yes |
| `bandFor`, pitch storage | same three boundaries | **yes** |

Every one correct on the day it was written. That is the whole difficulty: **a duplicate is never
wrong when you write it.** §2.2 reads like a tidiness rule until you notice that all three of
these passed review, passed tests, and were annotated with reasoning.

Two were found by looking. This one was found by writing down what the previous look could not
see, and then going there — which is a technique worth more than the fix.

## Layers (§1.5.1)

1. **Structure** — one band table again, in the file whose docblock claims that status.
2. **Effectivity** — the number a rep reads is now the same number in both places.
3. **Composition** — this is a composition defect specifically: neither component was wrong
   alone, and mounting them on one page is what made the disagreement visible.
4. **Surface** — no layout change; the labels change for scores above 89 and below 40.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving; a confident answer that arrived quickly is the one to distrust.",
    "how_this_build_will_embody_it": "Inferring three thresholds correctly from two mockup values felt like evidence. It was a coincidence that made a copy feel earned, and the real source was one file away." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The governing source must be in the tree AND consulted at the moment of action.",
    "how_this_build_will_embody_it": "Second instance today of present-and-unread. The bands file is in the same lib/coach tree as the code that duplicated it." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Examine it as a detached observer with no sunk cost.",
    "how_this_build_will_embody_it": "The sunk cost was a function I wrote two days ago with a careful comment explaining its assumption. The outside question — does anything else in this product already print a band? — took precedence over the annotation." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "Mounting PitchBreakdown under RepArena is what created the visible contradiction. The two components were each correct; the composition was not, and nothing about either file would have shown it." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Layer 3 is synergetic composition — how a feature composes with what surrounds it.",
    "how_this_build_will_embody_it": "A textbook layer-3 defect: both layer-2s pass, and the failure exists only in the pairing." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first about what could be wrong, then search to confirm.",
    "how_this_build_will_embody_it": "The hypothesis was written into the previous build's own closing sentence before the search existed. Naming the blind spot precisely is what turned it into a place to look." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T13:25:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2 rather than being deferrable polish.",
    "how_this_build_will_embody_it": "Band LABELS are what a rep reads. 'Early' versus 'Needs coaching' is not styling — it is what the product tells someone about their own work, and the founder's wording already existed." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-09-21T16:05:00Z",
    "why_it_governs": "Identify problems by looking backward at the actual record, and detect PATTERNS across incidents rather than the symptom in front of you.",
    "how_this_build_will_embody_it": "The pattern is the finding. One duplicate is a slip; three in a session, each correct when written, is a class — and it is only visible by looking back across all three." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-190", "read_at": "2026-09-21T13:55:00Z",
    "why_it_governs": "A silent dependence is the defect; prefer a loud failure over a quiet wrong answer.",
    "how_this_build_will_embody_it": "The copy depended silently on the authority staying put. Nothing would have failed if the authority changed — the two would simply have diverged further, which is the quiet wrong answer this clause is about." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "231-256", "read_at": "2026-09-21T16:40:00Z",
    "why_it_governs": "Audit ground-up, in the outside-view stance, producing honest flags — and an EMPTY flag list at a layer is itself a suspicious finding worth questioning.",
    "how_this_build_will_embody_it": "The previous sweep came back empty, and this clause is why that was not accepted. Questioning the empty result — by asking what the sweep structurally could not see — is what produced this build." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-280", "read_at": "2026-09-21T13:52:00Z",
    "why_it_governs": "Diagnose before patching; state the root cause and why it produces the symptom before proposing a change.",
    "how_this_build_will_embody_it": "The root cause is not 'a wrong threshold' — the thresholds were right. It is that a second table existed at all, which is why the fix deletes the copy rather than correcting its numbers." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Nothing is discarded; past reasoning is a reusable asset.",
    "how_this_build_will_embody_it": "The wrong docblock is kept in full inside the corrected function rather than replaced, because the near-miss — right boundaries, wrong set — is the transferable part and the fix is not." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T13:26:00Z",
    "why_it_governs": "Guide, do not overtake: surface and explain rather than silently deciding, and never take a decision that belongs to the human.",
    "how_this_build_will_embody_it": "Renaming a band from the founder's 'Needs coaching' to my 'Early' is an overtake in one string literal — a decision about what the product says to a rep about their own work, taken quietly. The fix un-takes it." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-394", "read_at": "2026-09-21T14:50:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation; make the System's learning visible.",
    "how_this_build_will_embody_it": "A band is the visible form of a score. Two bands for one number is worse than an invisible improvement — it is visible SELF-CONTRADICTION, and the rep is the one who has to reconcile it." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-21T15:55:00Z",
    "why_it_governs": "The System must refuse to believe its own evolution until results prove it; a fluent novel-sounding method with no validated result is not learning.",
    "how_this_build_will_embody_it": "The copy's docblock was exactly that artefact — fluent, self-aware about its own uncertainty, and unvalidated. Refusing to believe it meant checking whether the product already had an answer, which it did." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "One decision, one source; duplicated conditions drift, and every automated check stays green while they do.",
    "how_this_build_will_embody_it": "Third instance in one session, and the one that proves the clause is not pedantry: all three copies were CORRECT when written, all three passed tests, and this one disagreed on one page from the moment it shipped." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible.",
    "how_this_build_will_embody_it": "A band is the plain-language form of the score. Two labels for one number is the least defensible state a metric can be in — it is not disputed, it is self-contradicting." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "Knowledge is not intelligence; a fast fluent answer imitates understanding convincingly.",
    "how_this_build_will_embody_it": "The original comment is the artefact: it names its evidence, flags its own uncertainty, and is wrong — the full appearance of rigour around an answer produced without looking." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "A decision for the founder is a picker, never a quiet default.",
    "how_this_build_will_embody_it": "Band wording is the founder's and already existed. My copy silently took that decision by renaming a band — the overtake §3.3 forbids, in one string literal." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Holding the labels without the content produces work in the language of the discipline that violates it.",
    "how_this_build_will_embody_it": "Literally labels, in this case: 'Strong' and 'Solid' matched the authority's wording, which is what made the missing 'Elite' invisible." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "The bands file was read in full before the fix, rather than trusting the summary of it I could have written from the two thresholds I already knew." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A lesson in prose returns; encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The guard asserts agreement at every half-point 0-130. Reinstating the old copy fails three tests; before it, zero — which is the measure of what the previous tests were worth." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-858", "read_at": "2026-09-21T13:56:00Z",
    "why_it_governs": "When a pattern resists precise detection, find the CHOKEPOINT where the invariant holds by construction.",
    "how_this_build_will_embody_it": "There is no precise detector for 'someone re-derived a table'. The chokepoint is importing the authority, and the cross-check test is what makes leaving it fail." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual is the highest-yield queue, and writing it as a disclaimer is what stops you returning to it.",
    "how_this_build_will_embody_it": "The purest demonstration yet: the previous build's closing paragraph described a blind spot, and reading it back as an instruction rather than a caveat found a live defect in under five minutes." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a command you ran.",
    "how_this_build_will_embody_it": "The guard's worth was measured, not asserted: the old copy was reinstated and the suite re-run, giving three failures where there had been none." }
]
```
