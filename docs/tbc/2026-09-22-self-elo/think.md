---
started_at: 2026-09-22T09:30:00+08:00
trigger: R2 of the sweep's closure — the KPI document asks the agent view to lead with what improved, and the board led with what a rep is best at, because it read one period and had no baseline.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a fact about a rep, or a fact about their growth

## Why (the record)

From the sweep's closure:

> *"'your strongest is Tone' is a fact about a rep, and 'Tone improved 4 points this month' is a
> fact about their growth. The document is explicitly about the second — self-Elo,
> agent-vs-their-own-past — and the entire KPI system is built on that comparison. What shipped is
> the closest thing one period can say."*

The founder ruled that document wins on anything a rep sees. Approximating its first design
principle and recording the gap was the right move for that build and is not a place to leave it.

## The part that is not arithmetic

Subtracting two averages is trivial. The work is in refusing to.

`docs/SalesCoach-KPI-System.md` principle 3: *"No KPI asserts a conclusion without sufficient
evidence. 'Insufficient data' must be a valid, visible state."* That is §3.2 of the constitution
written in the KPI system's own vocabulary, and it lands directly on this feature — a rep with two
pitches this week and two last week has a comparison the maths will happily produce and the
evidence will not support. One Hit moves an element's average by its full value.

So the function returns a **verdict**, and the third case is not a fallback. A board that quietly
showed the strength instead would be answering a question it had not answered, which is exactly
what "visible state" forbids.

## Three states, and two of them are easy to collapse

| | means | the mistake |
|---|---|---|
| `improved` | enough evidence, something rose | — |
| `no_change` | enough evidence, nothing rose | reporting it as insufficient, which is a lie in the flattering direction |
| `insufficient` | not enough to say | rendering it as "nothing improved", which is a claim |

Those two mistakes are the same error from opposite ends, and each produces a board that looks
like it is working. Both are mutations.

## The threshold is mine

`MIN_PITCHES_FOR_COMPARISON = 3`. The rubric has no constant for this and the KPI document names no
number — it names the requirement. Three is the smallest count at which one pitch cannot dominate
the comparison on its own.

It is a judgement about evidence, it is not approved, and it is exported and named rather than
written into an inequality so that arguing with it costs nothing.

## What could go wrong, before I look

1. **Comparing without a gate** — arithmetic presented as a finding.
2. **`no_change` folded into `insufficient`** — flattering.
3. **`insufficient` rendered as `no_change`** — a claim.
4. **An element with no baseline winning**, because its gain is its whole value.
5. **Overlapping windows**, so a boundary pitch becomes its own baseline.
6. **The baseline read failing the board**, when the current period is still true.

All six became tests, and five became mutations.

## Session-read manifest

```json
[
  { "id": "§3.2", "source_file": "CLAUDE.md", "line_range": "347-351", "read_at": "2026-09-22T09:32:00Z",
    "why_it_governs": "The Understanding Gate is structural, not optional: a problem may not be surfaced until it links to a minimum threshold of supporting signals, and the schema itself must prevent half-understood problems reaching a human.",
    "how_this_build_will_embody_it": "The clause this build is mostly made of. The KPI document states the same requirement in its own words — 'insufficient data must be a valid, visible state' — and the verdict type is how the bottleneck is encoded rather than left to the caller's discretion." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T09:33:00Z",
    "why_it_governs": "Measure downstream consequence, never agreement; capture context so gains can be shown to hold controlling for circumstance, and be honest when an improvement was partly circumstantial.",
    "how_this_build_will_embody_it": "Self-Elo is the comparison §3.5 is built around. The honesty clause is why the floor and the threshold exist: a 0.1-point move on two pitches is circumstance, and reporting it as growth is the vanity metric this section forbids." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-22T09:34:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation; surface evidence periodically that the system knows more than it did.",
    "how_this_build_will_embody_it": "The whole point of leading with improvement. A board that only ever names a deficit tells a rep nothing has changed, whatever the numbers underneath say." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-22T09:35:00Z",
    "why_it_governs": "Guide, don't overtake; making the human a participant is what makes accurate-but-unwelcome insight survivable.",
    "how_this_build_will_embody_it": "Before-and-after rather than a delta: 4.5 to 6.9 hands a rep the two numbers and lets them judge the movement, where +2.4 asserts a conclusion they cannot check." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-22T09:36:00Z",
    "why_it_governs": "A decision is returned as a verdict and consumed; never re-derived downstream.",
    "how_this_build_will_embody_it": "The route returns a verdict, not a delta and a count for the surface to judge. A component deciding for itself whether two periods are comparable would be a second copy of the understanding gate, and the copy that drifts is the one nobody is looking at." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T09:37:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2 and cannot be deferred as polish.",
    "how_this_build_will_embody_it": "'Lead with what improved' is the founder's document specifying an experience. The previous build shipped an approximation and labelled it; this one implements the clause, which is what §1.5.4 says was owed." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T09:31:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "Literally the feature: the build is a refusal to assert a conclusion the evidence does not support, encoded as a type rather than as care." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T09:38:00Z",
    "why_it_governs": "The governing methodology must be in the tree and consulted at the moment of action.",
    "how_this_build_will_embody_it": "The KPI document was read in full one build ago, after four builds of quoting one sentence. Principles 1 and 3 — both load-bearing here — are among the parts I had never opened." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-22T09:39:00Z",
    "why_it_governs": "Retrospective Identification from the record.",
    "how_this_build_will_embody_it": "The record is the sweep's R2, which named the gap, named why the approximation was chosen, and named what closing it needs." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-22T09:40:00Z",
    "why_it_governs": "Outside-Perspective Identification.",
    "how_this_build_will_embody_it": "The outside reading of the strength callout I shipped yesterday: it answers a question the document did not ask, in the slot where the answer it did ask for belongs." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-22T09:41:00Z",
    "why_it_governs": "Holistic — trace ripple effects.",
    "how_this_build_will_embody_it": "A second read doubles this route's database work, and the verdict is a new required-ish field on a response an older server does not send. Both traced: the read is best-effort, the field is optional, and the board renders unchanged without it." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T09:42:00Z",
    "why_it_governs": "Four layers; layer 2 asks whether the feature delivers the intended result end to end.",
    "how_this_build_will_embody_it": "The intended result is a rep seeing their own growth. A verdict returned but rendered as nothing would pass every unit test and deliver none of it, which is why the insufficient branch has its own render test." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T09:43:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Six hypotheses before writing. The two that mattered are the collapse of no_change into insufficient and its mirror — the same error from opposite ends, both producing a board that looks like it works." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-22T09:44:00Z",
    "why_it_governs": "External-config completeness.",
    "how_this_build_will_embody_it": "Does not bind: no config outside the repo. The second read uses the caller's own client and the same RLS." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-22T09:45:00Z",
    "why_it_governs": "Ground-up auditing; a flag low down is leveraged more than one at the top.",
    "how_this_build_will_embody_it": "The window arithmetic is the lowest layer here: overlapping windows would make a boundary pitch its own baseline and flatten every comparison toward zero, silently and for everyone." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-22T09:46:00Z",
    "why_it_governs": "Diagnose before patching; explain the WHY.",
    "how_this_build_will_embody_it": "The threshold's REASONING is in the constant's docblock rather than the number alone, because a number without its argument is a thing the next person rounds." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T09:47:00Z",
    "why_it_governs": "Append-only; state is derived by replaying events.",
    "how_this_build_will_embody_it": "The comparison is derived on every read from two windows over the same immutable rows. A stored baseline would be wrong the moment a manager corrected a pitch in the earlier period." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-22T09:48:00Z",
    "why_it_governs": "A method counts as learned only when measured against the alternative; the System must refuse to believe its own evolution until results prove it.",
    "how_this_build_will_embody_it": "This is §4 applied to a rep rather than to the System: refuse to believe an improvement until the evidence supports it. The threshold IS that refusal, encoded." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T09:49:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "A two-pitch comparison is exactly that — fast, precise-looking, and unsupported. The gate exists because the arithmetic never hesitates." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T09:50:00Z",
    "why_it_governs": "Item 0: founder decisions go through a picker.",
    "how_this_build_will_embody_it": "The threshold of three is the closest thing to one here. It is surfaced in the residual and in an exported constant rather than asked about mid-build, because the document requires SOME threshold and any number would have needed choosing to ship anything." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T09:51:00Z",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is encoded in a gate.",
    "how_this_build_will_embody_it": "Both collapses — no_change as insufficient, and insufficient as no_change — are failing mutations rather than comments warning against them." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-22T09:52:00Z",
    "why_it_governs": "Schema-complete is not built; the seam between the data and the surface.",
    "how_this_build_will_embody_it": "Cited carefully this time, having committed its failure yesterday: the verdict reaches a rendered sentence in the same build, and the insufficient branch has its own test so it cannot be the half that never arrives." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-22T09:53:00Z",
    "why_it_governs": "Verified is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md states plainly that no baseline has been read from a real table and that the threshold is unapproved." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-22T09:54:00Z",
    "why_it_governs": "A decision returned as a verdict and consumed, never re-derived.",
    "how_this_build_will_embody_it": "The literal shape of the API. `ImprovementVerdict` is the decision; the surface branches on its status and computes nothing about sufficiency." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-22T09:55:00Z",
    "why_it_governs": "Citing an asset without reading it in-session is A19 operating undetected.",
    "how_this_build_will_embody_it": "Principle 3 of the KPI document is load-bearing here and is in the section I had never opened until one build ago. Four builds cited that document without it." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T09:56:00Z",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "The KPI document and §3.2 were both opened before writing, rather than recalled from the four builds that quoted them." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-22T09:57:00Z",
    "why_it_governs": "Same-name-different-feature across modules.",
    "how_this_build_will_embody_it": "Does not bind. Read because 'improvement' could collide with the gamification Arena's trend bars, which also show movement over time — they measure points per session and this measures rubric points per pitch, and the labels differ accordingly." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-22T09:58:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "Does not bind: no migration." }
]
```
