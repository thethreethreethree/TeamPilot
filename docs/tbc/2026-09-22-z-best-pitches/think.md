---
started_at: 2026-09-22T16:10:00+08:00
trigger: The mobile Progress board was built to the mockup and shipped without its three best-pitch cards, because nothing served a list. The founder chose to build the endpoint rather than leave them out.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a rep's best pitches had no list

## Why (the record)

Mockup p1 draws YOUR BEST PITCHES as three cards, each with a score, a date and a way into that
pitch. `aggregatePitches` produces `bestPitchScore` - one number, from `reduce(Math.max)`. Enough
for the gauge's "Best 106.5" and nothing else: no list, no dates, no ids.

The board shipped without the cards rather than assembling three plausible ones from whatever was
nearest, and the absence was written into its docblock. The founder then chose to build the source.

## The decision inside it

"Best" has two candidate meanings in a product that ranks on one of them, and the wrong choice
would not have been visible. A board ranking by BASE would have shown three real pitches, in a real
order, with real dates - celebrating work that contributed nothing to the total printed beside it.

The rubric settles it: a pitch counts only above the qualifying base, and "Best Pitch award goes to
the highest single score". Total, not base, because the bonus is part of what a rep competes on.

## The edge the column already decided

`session_id uuid references coaching_sessions(id) on delete set null`. A pitch outlives its session.
Filtering on a non-null session - the obvious way to guarantee every card is tappable - would have
dropped a rep's highest pitch because its recording was purged.

## Not opened

- The Pitch Score implementation guide named on guide page 2. Not in the repository; never read. It
  does not govern this route, but it is where a stated tie-break rule would live if one exists.

## Session-read manifest (3.1.2 / A35)

Re-read for THIS build, not carried over. The first draft reused the timestamps from the rubric-
endpoint build earlier today and the gate refused it: those reads predate this build's start. §3.1.2
is explicit — *"read_at must be this session. 'Earlier session' or 'I remember it' → stop, open the
file, read it, then write the timestamp."* So the files were opened again and these are the real
times.

```json
[
  { "id": "§0",
    "read_at": "2026-09-22T16:32:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "why_it_governs": "The temptation here was to assemble three best-pitch cards from whatever data was nearest, which is a solution reached before the problem was stated.",
    "how_this_build_will_embody_it": "The board shipped WITHOUT the cards first, and the absence was written into its docblock. The endpoint exists because the gap was diagnosed and put to the founder, not because three cards looked buildable." },

  { "id": "§0.1",
    "read_at": "2026-09-22T16:32:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "why_it_governs": "The Pitch Score implementation guide, named on guide page 2, is not in the working tree.",
    "how_this_build_will_embody_it": "Escalated rather than worked around, in this file's Not-opened and in the closure. It is where a stated tie-break rule would live, which is residual R3 here rather than a guess in the route." },

  { "id": "§1.5.1",
    "read_at": "2026-09-22T16:33:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "why_it_governs": "Layer 2 asks whether the feature works when a real caller invokes it — explicitly NOT whether the unit test passes.",
    "how_this_build_will_embody_it": "Layer 2 is honestly INCOMPLETE and recorded as residual R1: nine tests exercise the handler against a stub and no client has called this by HTTP. Reported as untested over the wire rather than as working." },

  { "id": "§1.5.2",
    "read_at": "2026-09-22T16:33:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "why_it_governs": "THINK first, then search. The hypothesis was that a best-pitches list probably existed somewhere already.",
    "how_this_build_will_embody_it": "Tested by reading `bestPitchScore`'s derivation rather than its name — reduce(Math.max) is one number, which is what proved the list absent instead of merely unfound." },

  { "id": "§1.5.4",
    "read_at": "2026-09-22T16:33:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "198-229",
    "why_it_governs": "It separates agent-originated design from a user-specified experience, which binds at layer 2.",
    "how_this_build_will_embody_it": "Applies, and is honoured: the founder specified these three cards by choosing to build them over leaving them out. They are the result, not polish — which is why the route was built before M6 rather than deferred." },

  { "id": "§2.2",
    "read_at": "2026-09-22T16:34:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "307-324",
    "why_it_governs": "\"Best\" is a decision with two candidate meanings in a product that already ranks on one of them.",
    "how_this_build_will_embody_it": "The route consumes the rubric's own rule — qualifying only, ranked by total — rather than inventing a second sense of best. A board ranking by base would have shown three real pitches in a real order, celebrating work that contributed nothing to the total beside it." },

  { "id": "§3.1.2",
    "read_at": "2026-09-22T16:35:00+08:00",
    "source_file": "docs/THINK_BUILD_CHECK.md",
    "line_range": "119-152",
    "why_it_governs": "It defines this manifest and the rule that caught its first draft.",
    "how_this_build_will_embody_it": "The carried-over timestamps were refused, the files were reopened, and these times are the reopening. The gate enforced the thing it exists for, on me, in this build." },

  { "id": "§6",
    "read_at": "2026-09-22T16:34:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "why_it_governs": "Item 0 binds the choice to build this at all; item 1a binds the manifest.",
    "how_this_build_will_embody_it": "Item 0: building this route rather than shipping without the cards went to the founder as an AskUserQuestion picker with the trade priced — including that the cards link out of the app. Item 1a: the assets were read for this build, which is this manifest." },

  { "id": "A19",
    "read_at": "2026-09-22T16:35:00+08:00",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "why_it_governs": "Its third question is the one this manifest answers: have I read the relevant assets in the current session, not relied on cached labels?",
    "how_this_build_will_embody_it": "The honest answer for the first draft was no — they were read for a different build three hours earlier. They have now been read for this one." },

  { "id": "A22",
    "read_at": "2026-09-22T16:35:00+08:00",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-606",
    "why_it_governs": "Citing an asset without reading it in-session is the failure it names, and the first draft of this file was exactly that shape.",
    "how_this_build_will_embody_it": "Corrected by reopening rather than by moving this build's start time backwards, which would have made the manifest pass and the claim false." },

  { "id": "A30",
    "read_at": "2026-09-22T16:35:00+08:00",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-780",
    "why_it_governs": "A lesson recorded only in prose returns. \"Best means total, and only counted pitches\" is such a lesson.",
    "how_this_build_will_embody_it": "Encoded in tests that record the filters the route applies — qualifying true, ordered by total descending — so ranking by base fails a named test instead of a comment being ignored." },

  { "id": "A38",
    "read_at": "2026-09-22T16:36:00+08:00",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1011",
    "why_it_governs": "Nine passing tests and a clean tsc are not the project's gate.",
    "how_this_build_will_embody_it": "`npm run check` is run in full before the commit and its result recorded in the closure. A vitest run on one directory is not described as verification." }
]
```
