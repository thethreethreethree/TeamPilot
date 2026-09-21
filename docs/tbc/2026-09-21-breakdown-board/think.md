---
started_at: 2026-09-21T15:10:00+08:00
trigger: An orphan sweep found aggregatePitches — 17 tests, no caller. The same shape the engine had two builds ago, and the reason the Breakdown board did not exist.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the aggregator nobody was calling

## Why (the record)

Before picking the next build I swept the pitch-score package for modules with no non-test
importer — A31, schema-complete is not built, applied to code rather than schema.

One result: `aggregate.ts`. Seventeen passing tests, four exported functions, **zero callers**.
Every rubric average a rep would ever see was already implemented and unreachable, which is why
the Breakdown board did not exist rather than being half-built.

This is the third orphan in two days of this feature: the scoring engine had no caller until the
route was built, the route had no surface until the panel, and the aggregator was sitting behind
both. Worth noting as a pattern rather than three coincidences — a package built bottom-up
accumulates finished components that nothing reaches, and each one looks like progress in the
test count.

## What was blocking it

`AggregablePitch.score` required a full `PitchScore`.

A reader loading pitches out of the database has `base`, `bonus`, `total`, `qualifying`,
`section_points` and the event rows — but no `elementBreakdown`, because it holds the element rows
separately. Satisfying the type would mean fabricating one.

A fabricated field that nothing currently reads is still a lie in the data, and the person who
later adds a use for it gets an empty array with nothing indicating it was never real. So the
input type is narrowed to the nine fields the aggregation actually touches (checked by grepping
`p.score.` rather than by reading it), and a live `PitchScore` still satisfies it.

## The bug the tests caught, which typecheck could not

`readPitchPeriod` built its query as `.select().order().limit()` and *then* applied
`.eq("rep_id")`, `.gte`, `.lt`.

That throws at runtime. supabase-js returns a `PostgrestTransformBuilder` from `.order()` and
`.limit()`, and that builder has no `.eq()`. It typechecked only because the injected client is
an un-generic `SupabaseClient`, which loosens the whole chain to `any`.

It was caught because the test records **which filters were actually applied** rather than
asserting on returned rows — a test that only checked the output would have been given the
fixture regardless and passed. The failure mode it would have shipped is the worst available on
this surface: a rep's board showing the whole company's averages as their own, with no error.

## What the board is for, and what follows from it

Telling a rep the one thing worth practising this week.

Thirty accurate percentages is not that. It is the same data with the decision handed back to the
reader, and a rep who opens it twice stops opening it. So:

- **The opportunity is ranked by points lost**, not by miss rate. An 8-point element missed half
  the time costs four points a pitch; a 2-point element missed entirely costs two. Ranking by rate
  sends the rep after the smaller prize and reads as being nagged about something that barely
  counts.
- **It is stated in points, and in the period's own terms** — *"adds 2.2 points per pitch, about
  40 points across your 18 counted pitches"*. A percentage is accurate and unactionable.
- **A gap under a tenth of a point is not shown at all.** A rep who is doing well must not be
  handed a target that cannot move.

## The reconciliation is printed on screen

`base + bonus − violations = the average`. The launch checklist requires the identity; printing it
is what makes it checkable by the person most likely to notice — the rep whose number it is.

It is also the reason the aggregation runs server-side rather than in the browser. Thirty element
rates over up to 500 pitches would mean shipping a rep's entire scoring history down the wire to
draw six bars, and it would mean a second implementation of the averages, which is how the
identity stops holding.

## Contradiction noted: "today" is not the rep's today

The period filter uses the **server's** clock, so `day` means the last 24 hours rather than the
rep's local calendar day. A rep near midnight will disagree with it.

The door log already solved this properly, with a device timezone and a computed local sales-day.
This board has no such input yet. Rather than approximate a calendar day badly, it uses a rolling
window and the limitation is stated here and in the source. Carried as residual R2 rather than
fixed by guessing a timezone.

## Layers (§1.5.1)

1. **Structure** — reader, aggregator, route, board, each with one job. The aggregator was already
   right; nothing about it changed except its input type narrowing.
2. **Effectivity** — read through the caller's client, so RLS is the access rule. The route adds
   no role check, because a second expression of that decision is the thing §2.2 forbids.
3. **Composition** — the board sits under the arena on My Progress: the arena answers *how am I
   doing*, the breakdown answers *what do I practise*. Reversed, a rep meets thirty percentages
   before having a reason to care about them.
4. **Surface** — built to page 2 of the rep dashboard, which was opened and read.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The build was chosen by sweeping for orphans rather than by picking the next item on a list, which is how a fully-tested aggregator with no caller came to light." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The governing methodology must be in the tree and read now.",
    "how_this_build_will_embody_it": "aggregate.ts was read before being wired, which is how the full-PitchScore requirement was found to force a fabricated field. The Pitch Score implementation guide is still absent — R5." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Read it as a detached observer.",
    "how_this_build_will_embody_it": "The outside question was 'what does a rep do after reading this board?' — which rejected the accurate-but-inert wall of percentages that the aggregate data most naturally becomes." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — trace what else a change affects.",
    "how_this_build_will_embody_it": "Narrowing AggregablePitch.score touched the aggregator's 17 existing tests; they were run before anything else was built, and passing unchanged is the evidence the narrowing was behaviour-neutral." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Four layers; layer 3 asks whether the user can continue.",
    "how_this_build_will_embody_it": "Board order is a layer-3 decision: arena then breakdown, so the rep has a reason to read the detail before meeting it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first, then search; the agent co-owns quality rather than executing a list.",
    "how_this_build_will_embody_it": "The orphan sweep IS this clause — nobody asked whether anything in the package was unreachable, and the answer decided what to build." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T13:25:00Z",
    "why_it_governs": "A user-specified experience is layer 2, not deferrable polish.",
    "how_this_build_will_embody_it": "Page 2 of the rep dashboard specifies this board — the period switcher, the opportunity callout, the section bars, the bonus and violation tables and the reconciliation footer. It was opened and read, and built rather than approximated." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-190", "read_at": "2026-09-21T13:55:00Z",
    "why_it_governs": "Silent dependence is the defect; prefer failing where a human will see it.",
    "how_this_build_will_embody_it": "The board's failed-load state says out loud that it is not the same as having no pitches — a silent empty period is the in-app version of the silent config dependence this clause forbids." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-280", "read_at": "2026-09-21T13:52:00Z",
    "why_it_governs": "Diagnose before patching; trace what a change affects before making it.",
    "how_this_build_will_embody_it": "Narrowing a shared type was traced by running the aggregator's own suite FIRST, before building anything on top of it, rather than discovering the blast radius one failing file at a time." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Entity state is derived by replaying the record, never edited.",
    "how_this_build_will_embody_it": "Nothing is stored for this board. Every average is derived on read from the pitches and their child rows, so a re-scored pitch changes the board with no cache to invalidate." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T13:26:00Z",
    "why_it_governs": "Guide, do not overtake — offer the suggestion with its reasoning, and leave the human a participant.",
    "how_this_build_will_embody_it": "The opportunity callout names ONE thing and shows the arithmetic behind it (0.8 of 3, 2.2 points a pitch, 40 across the period), so the rep can disagree with the recommendation on the evidence rather than being handed a verdict." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-394", "read_at": "2026-09-21T14:50:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation; surface the evidence.",
    "how_this_build_will_embody_it": "The period switcher is the smallest version of this: a rep who improved this week can see this week differ from last, which is the only way an average becomes evidence rather than a number." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Consume the verdict; do not re-derive it.",
    "how_this_build_will_embody_it": "Section totals come from the stored verdict and bonus points from the events the scorer wrote, never from rubric face value — a re-derivation here corrupts every average rather than one pitch. The route adds no role check because RLS already decides that." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible; measure consequence.",
    "how_this_build_will_embody_it": "Rates are over the pitches an element was GRADED in, not over all counted pitches. An element the rep never reached is not a miss they can be coached on, and counting it as one would make every rate quietly pessimistic." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "The biggest risk is the builder under pressure making it less honest for a faster result.",
    "how_this_build_will_embody_it": "The fast path for a pre-0254 pitch was to include it with zero section points — one fewer branch. It would have dragged every section average down and read as a coaching problem. Excluded and counted instead." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "A decision for the founder is a picker.",
    "how_this_build_will_embody_it": "No decision taken. The local-calendar-day question is a real design choice and is left in the residual rather than settled by guessing a timezone." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Labels without content produce work in the language of the discipline that violates it.",
    "how_this_build_will_embody_it": "A fabricated elementBreakdown to satisfy a type is this failure in data: a field that carries the name of real evidence and holds none." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "The nine score fields the aggregator uses were established by grepping `p.score.` rather than by recalling what it needs — which is what made the narrowing exact rather than approximately right." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A lesson in prose returns; encode it in a gate.",
    "how_this_build_will_embody_it": "The ranking rule, the lowest-section ratio and the reconciliation footer are each pinned by a mutation. The filter-order bug is pinned by a test that records which filters were applied, not which rows came back." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-799", "read_at": "2026-09-21T15:15:00Z",
    "why_it_governs": "Schema-complete is not built — a fully-formed component with nothing reaching it is unfinished work that looks finished.",
    "how_this_build_will_embody_it": "The clause that chose this build. Seventeen passing tests on a module no user could reach is the exact shape, and it was found by counting importers rather than by reading the test count." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual is the highest-yield queue.",
    "how_this_build_will_embody_it": "Sixth consecutive build chosen from what the record already admitted was missing rather than from a feature list." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a command you ran.",
    "how_this_build_will_embody_it": "build:ci was run because this build ships UI; the whole suite was run because narrowing a shared type reaches beyond the files edited." }
]
```
