---
started_at: 2026-09-22T01:30:00+08:00
trigger: The milestone-strip collision, the last of the mapped two-systems collisions still open. The gamification Arena shows "First pitch scored" and "100 sessions"; the rubric sheet shows "First pitch" and "Century — 100 scored pitches". Built fresh, a rep earns two First-pitch badges and two Centuries under different names.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — six names, and the two meanings I was about to invent

## Why (the record)

`TWO-SCORING-SYSTEMS.md` row 33 left this open with the sharpest wording of any row in the table:

> **UNBUILT, AND TWO ALREADY OVERLAP.** `spark` is *"First pitch scored"* and the design has
> *"First pitch"*. `century` is *"100 sessions"* and the design has *"Century — 100 scored
> pitches"*. Built fresh, a rep earns two First-pitch badges and two Centuries under different
> names.

## The thing that nearly went wrong, and how it did not

The map records the six badge NAMES. It does not record their definitions. Building from that row
means inventing six meanings from six words, and I had two of them ready:

- Clean sweep → a pitch with no violations.
- Full bundle → several bonuses in one pitch.

Both are plausible. Both are wrong. The sheet is in the tree, and its captions say:

```
Full bundle     DTV + Wireless + ADT in one pitch
Clean sweep     Every phase fully hit
Century         100 scored pitches
```

Clean sweep is about the RUBRIC being fully hit, not about the rep's conduct. Full bundle names
three specific products. Had either shipped, the badge would have fired on the wrong pitches, no
test could have known, and a rep would have earned "Clean sweep" on a pitch that hit half the
rubric cleanly.

**What this is an instance of.** The map is an index that reads like a specification — the same
shape A22 describes for constitutional assets, one level down. A summary never discharges its
source. The fix was `pdftotext` and thirty seconds.

`tripleDigits` and `inTheDoor` have no caption and remain inferred. They are marked as inferred in
the module, because the honest state of a definition is part of the definition.

## The collision, and why merging is arithmetic rather than taste

The instinct is to have one set of milestones. It cannot be done without lying about a date.

| | Arena | Pitch Score |
|---|---|---|
| first badge | first SESSION on the points ledger | first COUNTED pitch |
| century | 100 sessions | 100 counted PITCHES |

A rep records sessions that never qualify — no Discovery, or under 40 base — so the two counts
diverge permanently and the same rep reaches them on different days. Merging means choosing one
denominator and silently moving every earned-at date the Arena has already shown. Those dates are
derived from the immutable ledger *precisely so they cannot move* (GAM-R13).

So both sets stand, each saying what it counts, and the one genuinely misleading label was changed:
`spark` said "First pitch scored" about a session. It now says "First session scored". Only the
label; no date moved.

This is the same resolution the scoreboard page reached earlier today for its two leaderboards, and
that is either a pattern or a rut. The argument that it is a pattern: in both cases the two numbers
measure different things that a team actually uses, and the collision was in the WORDS. The
argument that it is a rut: the product now has two leaderboards and two milestone strips, and
"label both" scales badly. Recorded in the residual rather than settled here.

## What could go wrong, before I look

1. **A definition invented from a name.** Two of six.
2. **A period window on an all-time question.** "Your first pitch was Monday."
3. **Newest-first plus a row cap** dating "First pitch" to the 900th-most-recent pitch.
4. **A milestone earned on a pitch that did not count.**
5. **A failed read rendering as six unearned badges** — a statement about the rep made on a network
   error.
6. **Unearned badges hidden**, turning a map into a trophy case.

All six became tests and mutations. The first two were the real ones.

## Session-read manifest

```json
[
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T01:32:00Z",
    "why_it_governs": "The methodology defining the work must be in the working tree at the moment of action; citing labels from a document not in the tree is forbidden.",
    "how_this_build_will_embody_it": "The load-bearing clause. The rep dashboard sheet IS in the tree, so the two wrong definitions were caught by reading it. The clause is usually about constitutional documents; here it applied to a product spec, and the failure mode was identical — I had the labels and was about to supply the content myself." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-22T01:33:00Z",
    "why_it_governs": "Citing an asset without reading it in-session is A19 operating undetected; a summary never discharges its source.",
    "how_this_build_will_embody_it": "TWO-SCORING-SYSTEMS.md is a summary of the sheet and reads like a specification. Building from its row would have been citing the sheet without opening it — A22's exact shape, applied to a product document." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-22T01:34:00Z",
    "why_it_governs": "Consume the verdict; never re-derive a decision an authority already judged.",
    "how_this_build_will_embody_it": "The qualifying verdict is consumed, never re-tested against 40. Full bundle reads the rubric's own bonus ids rather than a local list of products. And the relabelled Arena badge changes only its LABEL, leaving the ledger derivation as the single authority for its date." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-22T01:35:00Z",
    "why_it_governs": "Audits within modules miss same-name-different-feature failures across them; the user experiences a feature concept, not a module boundary.",
    "how_this_build_will_embody_it": "This build is A21's canonical case for the second time today. 'First pitch' meant two things in one product, and a rep experiences a badge rather than a module. The remedy is the same: name both, say what each counts." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T01:36:00Z",
    "why_it_governs": "Append-only; entity state is derived by replaying events, never edited.",
    "how_this_build_will_embody_it": "Why merging the two sets was rejected. The Arena's dates derive from the immutable ledger so they cannot move; a merged denominator would move them, which is editing derived history by changing its input." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-22T01:37:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "Why unearned badges are shown rather than hidden, with their captions. A strip showing only what a rep has earned is empty on day one and never tells them what there is to reach." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T01:38:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2, not as layer-4 polish.",
    "how_this_build_will_embody_it": "The sheet specifies six badges and their captions, so the captions are rendered rather than treated as design notes. It does NOT specify day-month order — that is locale convention, and the module says so instead of claiming the sheet as authority for it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T01:39:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Six hypotheses written before any code. The two that mattered — an invented definition, and a period window on an all-time question — were both about asking the wrong question rather than computing wrongly." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T01:40:00Z",
    "why_it_governs": "Four layers, foundation up; a feature that works in itself but breaks workflow continuity is incomplete.",
    "how_this_build_will_embody_it": "The strip sits between the Arena and the Breakdown on my-progress: where the rep stands, what they have reached, then why. A milestone strip at the bottom of a page of percentages would be a trophy nobody scrolls to." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-22T01:41:00Z",
    "why_it_governs": "Holistic: trace what else a change affects.",
    "how_this_build_will_embody_it": "`oldestFirst` and `recordedAt` are additions to shared code. Both are optional and default to the previous behaviour, so the period board and the breakdown are untouched — checked by running their suites, not by reasoning about them." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T01:42:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "The whole build. 'Clean sweep means no violations' arrived instantly, felt obvious, and was wrong — the clearest instance this session of a fast, fluent, plausible answer that only the source could refute." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T01:31:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The problem was not 'build six badges'. It was that two of them already exist under other names on a different denominator, which is what rules out building the set fresh and what makes relabelling the Arena the smaller half of the fix." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-22T01:43:00Z",
    "why_it_governs": "Retrospective Identification from the record.",
    "how_this_build_will_embody_it": "The map's row 33 stated the collision precisely in the morning and was acted on rather than re-derived. What it did NOT state was the definitions, and noticing that gap is the whole build." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-22T01:44:00Z",
    "why_it_governs": "Outside-Perspective Identification.",
    "how_this_build_will_embody_it": "The outside reading of two milestone strips on one page: it looks like a product that could not decide. That reading is recorded in the residual rather than argued away, because it may be right." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-22T01:45:00Z",
    "why_it_governs": "External-config completeness.",
    "how_this_build_will_embody_it": "Checked and does not bind: no dashboard setting, allowlist, env or webhook. The route is caller-scoped and needs no service-role key." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-22T01:46:00Z",
    "why_it_governs": "Ground-up auditing; a flag low down is leveraged more than one at the top.",
    "how_this_build_will_embody_it": "The read's ORDER is the lowest layer here and the least visible: `oldestFirst` is a one-word argument whose absence would misdate a badge for exactly the busiest reps, and nothing above it could detect that." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-22T01:47:00Z",
    "why_it_governs": "Diagnose before patching; interrogate locked doors.",
    "how_this_build_will_embody_it": "Applied to the corrupted regex. 'Expected Aug 12 to match /12/' is impossible, so the message was wrong rather than the code — which led to the byte rather than to a rewritten assertion that happened to pass." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-22T01:48:00Z",
    "why_it_governs": "Guide, don't overtake: default to proposing and explaining rather than silently deciding, state assumptions inline, and never take a call that belongs to the human.",
    "how_this_build_will_embody_it": "Two inferred definitions are marked as inferred rather than presented as specified, so the founder can correct them knowing which are theirs and which are mine." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T01:49:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible.",
    "how_this_build_will_embody_it": "Each badge is defensible because its rule is printed beneath it. A milestone whose condition is invisible is a number a rep cannot argue with, which is the shape §3.5 exists to prevent." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-22T01:50:00Z",
    "why_it_governs": "Validated against the alternative, not asserted.",
    "how_this_build_will_embody_it": "The two wrong definitions are encoded AS MUTATIONS, so the alternative readings are tested rather than argued about. 'Clean sweep = no violations' is now a failing test." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T01:51:00Z",
    "why_it_governs": "Item 0: founder decisions go through a picker.",
    "how_this_build_will_embody_it": "No new decision arose — the founder directed the remaining items be finished. The two inferred definitions are the closest thing to one and are surfaced in the residual rather than asked about mid-build." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T01:52:00Z",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is in a gate.",
    "how_this_build_will_embody_it": "The definitions are gated as mutations. The METHOD — read the source, not the summary — is prose and will return, which is stated in remediate.md rather than dressed as a gate. Also why no repo-wide lint rule was added for F2: a noisy gate introduced in reaction to one incident is A30's own failure mode." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-22T01:53:00Z",
    "why_it_governs": "Schema-complete is not built.",
    "how_this_build_will_embody_it": "Module, route, component and page in one build, with the page wired before the reachability gate could report the component unmounted." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-22T01:54:00Z",
    "why_it_governs": "Verified is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the run with its exit code, states 25-of-25 mutations, and records the repo-wide byte sweep as the command that was actually executed rather than as an assurance." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-22T01:55:00Z",
    "why_it_governs": "A decision returned as a verdict and consumed, never re-derived.",
    "how_this_build_will_embody_it": "`qualifying` travels from the scorer into the milestone filter untouched. A re-derivation against 40 here would be a fourth place that rule lives." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-22T01:56:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "Does not bind: no migration. Stated rather than skipped, since the baseline is now empty and any lapse would be the first entry back on it." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T01:57:00Z",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "The sheet was opened this session and its text extracted. The standing exception is unchanged and is now pointed: the 2026-09-19 instruction image is the one asset in this workstream that CANNOT be opened, and this build is a demonstration of what opening one is worth." }
]
```
