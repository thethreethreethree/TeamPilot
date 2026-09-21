---
started_at: 2026-09-22T04:00:00+08:00
trigger: Today's Metrics was the last item on my own status page. Reading the sheet before building it showed there is no such page to build — and showed a specified, unbuilt piece of the Progress board sitting beside it.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the board that was a tab, and the line that was a spec

## Why (the record)

My own status page listed "Today's Metrics board" as remaining work, with the note that
`TodaysMetricsPager.tsx` contains zero references to pitch score and is therefore a different
board. That much was right.

What I had not done was open the sheet. One build after recording F1 of the milestones build —
*"the two definitions I was about to invent were both wrong"* — the correct first move was
obvious, and it paid immediately:

**The sheet has four content pages.** Progress, Breakdown, Pitch detail, How points work. Its
sub-nav shows three tabs — Progress | Breakdown | **Metrics** — and there is no Metrics page. The
"Today's Metrics" in the bottom nav is a different section of the app entirely, already built to
the founder's 2026-09-04 Macro spec.

So the thing I was about to build does not exist as a specification. Building it would have meant
inventing a board's contents from the word on its tab — the milestones failure again, one level up:
there I would have invented a badge's meaning from its name, here a whole surface from a label.

**It is not built. It is recorded as needing the founder.** That is the entire outcome of looking.

## What looking DID find

Page 1, the Progress board, is specified in detail and mostly unbuilt. One line stood out:

```
62 pts behind #1        118 pts ahead of #3
```

It is buildable today — the leaderboard shipped this session — and it is buildable *for a rep*,
which nothing else on that page is, because **a distance is not a person**.

That matters because of section L. `SalesCoach-KPI-System.md` forbids cross-agent ranking being how
results are framed to an agent, and the access split I built earlier gives a rep their rank and
nothing else. Gaps fit inside that split exactly: they carry the competition — how close, which
direction, how much work — without exposing a name, a total, or a list.

## The one genuine ambiguity, and how it was settled

For a rep at #2, "behind #1" and "behind the rep above me" are the same thing, so the sheet's
example cannot distinguish them. The pair settles it: the second half says "#3", which for a #2 rep
is the one below, not the one at the bottom. Neighbours.

The second argument is about what the board is for. A gap to the leader is fixed and mostly
unreachable; a gap to the rep above is the next thing a person can actually do. A progress board
that opened with an unreachable number would be the §3.6 failure — visible, accurate, and
demotivating.

## What could go wrong, before I look

1. **Naming the rank**, which reveals another person's position.
2. **Null treated as zero** — the leader shown as "0 pts behind".
3. **Zero treated as null** — a dead heat rendered as nobody, via a truthiness check.
4. **Behind and ahead swapped**, which is invisible without a fixture where they differ.
5. **Float noise at a near-tie.**

All five became mutations. The fifth is the one I got wrong in the comment before I got it right in
the code.

## Session-read manifest

```json
[
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T04:02:00Z",
    "why_it_governs": "The methodology defining the work must be in the working tree at the moment of action, and citing what a document says without opening it is forbidden.",
    "how_this_build_will_embody_it": "The whole build turns on it. Opening the sheet dissolved the task I had planned and produced a different one. The previous build learned this about badge definitions; this one applied it before starting rather than during." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-22T04:03:00Z",
    "why_it_governs": "Citing an asset without reading it in-session is A19 operating undetected; a summary never discharges its source.",
    "how_this_build_will_embody_it": "The summary here was MY OWN status page, which listed a board that does not exist in the spec. An artifact I wrote became the source I was about to build from — the same trap as the two-systems map, one remove further from the sheet." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-22T04:04:00Z",
    "why_it_governs": "Guide, don't overtake: default to proposing and explaining rather than silently deciding, and never take a call that belongs to the human.",
    "how_this_build_will_embody_it": "The Metrics tab is not built. Filling an unspecified surface would be deciding what a rep sees on the founder's behalf, which is the overtake failure in its most expensive form — a whole screen." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-22T04:05:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "Why the gap is to the NEIGHBOUR rather than the leader. A distance a rep can close this week is perceptible progress; a fixed distance to an unreachable top is a number that never moves." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-22T04:06:00Z",
    "why_it_governs": "Consume the verdict; never re-derive a decision an authority already judged.",
    "how_this_build_will_embody_it": "`gapsAround` reads the board `buildPitchLeaderboard` already produced — same order, same ranks — rather than re-sorting or re-ranking. A second ordering here would disagree with the list on the same screen." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T04:07:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "F1. '80.3 - 18.4 is 61.8999...' was written confidently into a code comment and is simply false. The rounding was right; the reason given for it was invented, and a surviving mutation is what exposed it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T04:08:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Five hypotheses before writing, all five mutated. The null-versus-zero pair is the one worth having thought about in advance: they are opposite bugs with the same shape, and a truthiness check produces the second by accident." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T04:09:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2 rather than being deferred as polish.",
    "how_this_build_will_embody_it": "The sheet specifies this line, so it is built rather than filed as a nicety. It also specifies the WORDING — '62 pts behind #1' — and I substituted 'the rep above' because the rank names a person's position. That substitution is recorded as not-verified rather than presented as the spec." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T04:01:00Z",
    "why_it_governs": "Understanding precedes solving; if you cannot articulate why the problem exists you may not solve it yet.",
    "how_this_build_will_embody_it": "The stated problem — 'Today's Metrics is unbuilt' — turned out not to be a problem at all. Being unable to say WHY that board should exist, beyond a tab label, is what stopped it being built." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-22T04:10:00Z",
    "why_it_governs": "Retrospective Identification: work from the record, and detect patterns across incidents.",
    "how_this_build_will_embody_it": "The pattern is one build old: invent-from-a-name almost shipped two wrong badge definitions. Recognising the same shape in 'Today's Metrics board' is the only reason the sheet was opened first." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-22T04:11:00Z",
    "why_it_governs": "Outside-Perspective Identification: read the problem with no stake in the existing choices.",
    "how_this_build_will_embody_it": "The outside reading of my own status page: it is a summary written by someone who had not opened the sheet for that row. Treating my own artifact as untrusted is the move." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-22T04:12:00Z",
    "why_it_governs": "Holistic — trace ripple effects before acting.",
    "how_this_build_will_embody_it": "`gaps` is a new required field on the response type, so every fixture of it breaks. Traced by running the suites; the component also carries a rollout guard so an older server's response without the field still renders." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T04:13:00Z",
    "why_it_governs": "Layer 3 asks whether the finished feature leaves the user able to continue.",
    "how_this_build_will_embody_it": "A rank alone is a position. A rank plus a distance is a next action — the rep can see what closing the gap would take. That is the continuity the standing card was missing." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-22T04:14:00Z",
    "why_it_governs": "External-config completeness.",
    "how_this_build_will_embody_it": "Does not bind: no config outside the repo. Stated rather than skipped." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-22T04:15:00Z",
    "why_it_governs": "Ground-up auditing; a flag low down is leveraged more than one at the top.",
    "how_this_build_will_embody_it": "The rounding is the lowest layer here and the only one that could be wrong in a way nobody reports — fifteen decimal places printed between two near-level reps." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-22T04:16:00Z",
    "why_it_governs": "Diagnose before patching; interrogate locked doors.",
    "how_this_build_will_embody_it": "The surviving rounding mutation was diagnosed rather than patched. The fix was not 'make the test stricter' — it was finding out that the example in the comment was false." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T04:17:00Z",
    "why_it_governs": "Append-only; state is derived rather than edited.",
    "how_this_build_will_embody_it": "Gaps are derived on read from the board, never stored. A stored gap would be stale the moment any rep on the board scored." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T04:18:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible.",
    "how_this_build_will_embody_it": "A gap is the most defensible thing on this screen: it is a subtraction of two numbers the board already shows a manager, and it reveals nothing the rep could not infer from their own rank moving." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-22T04:19:00Z",
    "why_it_governs": "Validated against the alternative, not asserted.",
    "how_this_build_will_embody_it": "The gap-to-leader reading is encoded as a failing mutation, so the alternative interpretation of the sheet is tested rather than argued about." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T04:20:00Z",
    "why_it_governs": "Item 0: founder decisions go through a picker.",
    "how_this_build_will_embody_it": "Two are named rather than taken: what the Metrics tab contains, and whether the gap should name the rank as the sheet does. Both are surfaced in the closure; neither was filled in." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T04:21:00Z",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is encoded in a gate.",
    "how_this_build_will_embody_it": "Both readings of the sheet's line are now mutations. The METHOD — open the source before building from a summary — is prose, has now been learned twice in two builds, and is stated as prose rather than dressed as a gate." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-22T04:22:00Z",
    "why_it_governs": "Schema-complete is not built.",
    "how_this_build_will_embody_it": "Module, route and surface in one change — the gaps reach a sentence a rep reads, not just a response field." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-22T04:23:00Z",
    "why_it_governs": "Verified is a claim about a command you ran.",
    "how_this_build_will_embody_it": "The float claim was checked with `node -e` rather than asserted, which is exactly A38 applied to a comment instead of to a test suite." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-22T04:24:00Z",
    "why_it_governs": "A decision returned as a verdict and consumed, never re-derived.",
    "how_this_build_will_embody_it": "The board's ORDER is the verdict. `gapsAround` indexes into it rather than re-sorting, so the gaps cannot disagree with the ranks beside them." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-22T04:25:00Z",
    "why_it_governs": "Same-name-different-feature across modules.",
    "how_this_build_will_embody_it": "F2 is an instance: 'Today's Metrics' names a bottom-nav section AND appeared to name a Pitch Score board. One of those exists." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T04:26:00Z",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "The sheet was extracted and its page structure read before anything was written. The standing exception is unchanged and increasingly pointed: the 2026-09-19 instruction image is the one asset that cannot be opened." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-22T04:27:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "Does not bind: no migration." }
]
```
