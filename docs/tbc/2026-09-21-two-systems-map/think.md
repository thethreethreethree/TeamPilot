---
started_at: 2026-09-21T16:55:00+08:00
trigger: The band collision's own residual named the next step — the technique had been applied to exactly one number, and there were seven more.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the other seven numbers

## Why (the record)

The band collision closed with R1:

> *"The question that found this — does the product already print this number? — was asked about
> the band and nothing else… competitionRank.ts sitting beside a Pitch Score leaderboard is the
> same shape with more surface area."*

So this build asks it seven more times.

## What was found

**One live inconsistency, already shipped this morning.** The rubric sheet tells reps
*"Leaderboard = total points from counted pitches."* `/scoreboard` exists and ranks by the
gamification ledger's `total_points` — the mean of the v5 dimension scores × 10. Different
inputs, different scale, different number. The sheet asserted as current fact something the
product does not do.

**Two milestone collisions, caught before building.** `spark` is *"First pitch scored"* and the
design has *"First pitch"*. `century` is *"100 sessions"* and the design has *"Century — 100
scored pitches"*. Build the strip fresh and a rep earns two First-pitch badges and two Centuries
under different names.

**Two more authorities to consume when their surfaces are built.** `competitionRanks` for rank,
and the Arena's `best` — which is on a 0-100 scale while a Pitch Score best is 0-130, so the two
figures are not comparable and must never appear as one number.

**Two clean.** Prize eligibility has no counterpart. The qualifying rule has none either, though
it is worth knowing that a pitch can bank gamification points and not count toward the Pitch
Score board.

## The fix for the live one is a scope, not a rewrite

The rule is the founder's, quoted from the rubric PDF. Rewriting it would be the overtake §3.3
forbids; leaving it would be shipped copy that contradicts a tab in the same nav.

So it is scoped — *"Pitch Score leaderboard = …"*, with one parenthesis saying the Scoreboard tab
is a different board. The founder's rule survives intact and now names what it governs. Which
board the nav should actually show is row 2 of the map and stays theirs.

## I got a row wrong while writing the table

The first draft called `competitionRanks` **dense** ranking. It is **standard** competition
ranking — `rank = i + 1` on a non-tie, so 1-2-2-**4**, not 1-2-2-3.

That is the same failure the table exists to prevent, committed inside the table: a plausible
description of an authority, written without opening it. It is kept in the record because it is
the strongest available argument for the other seven rows having been read.

It also improved the row. The obvious hand-rolled ranker **is** dense, so a second implementation
would disagree the first time two reps tie — which is a sharper warning than "use the authority".

## What this build is honest about

A document is not a gate. The build guide was a document, and being three months stale cost an
afternoon earlier today. This table will go stale the same way.

It is still worth writing, because the alternative on offer is not a gate — nobody can write a
precise detector for *"these two numbers mean the same thing to a human"* (A33), and an imprecise
one would flag every integer in the codebase. What can be made cheap is the **question**, and a
table of the eight places it applies makes asking it a minute's work rather than an afternoon's.

## Layers (§1.5.1)

1. **Structure** — no code structure changes; one string and one document.
2. **Effectivity** — the shipped copy no longer contradicts a live tab.
3. **Composition** — the whole build is layer 3. Every finding is a pair-of-features defect;
   none of the individual features is wrong.
4. **Surface** — one rule line on the rubric sheet.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The understanding being earned here is of the OTHER system — seven files read, one per number, before any claim about whether they collide." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The governing source must be in the tree and consulted at the moment of action.",
    "how_this_build_will_embody_it": "Seven sources consulted. The one row written from memory instead was wrong, which is the cleanest demonstration of the clause this session has produced." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-09-21T16:05:00Z",
    "why_it_governs": "Look backward at the record and detect patterns ACROSS incidents, not the symptom in front of you.",
    "how_this_build_will_embody_it": "One collision is a bug; a table of eight places it could recur is the pattern. The table exists because three duplicates in a session stopped being coincidence." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Read it as a detached observer with no stake in the existing assumptions.",
    "how_this_build_will_embody_it": "The stance that produced the question. From inside the Pitch Score work the gamification system is background; from outside it is the thing a rep is already looking at." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — consider the whole system and its interconnections; never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "This build is the clause applied as a deliverable rather than a habit: the interconnections are enumerated in a table instead of held in someone's head." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Layer 3, synergetic composition — does invoking this leave the surrounding workflow intact?",
    "how_this_build_will_embody_it": "Every finding is a layer-3 defect. Each feature passes on its own; the failure exists only in the pair, which is precisely what the layer was added to catch." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first about what could fail, then search; five sharp findings beat fifty from grep.",
    "how_this_build_will_embody_it": "Eight numbers, eight files, five findings. None came from pattern-matching — each needed reading what the other system actually computes." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T13:25:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2; it is the intended result, not deferrable polish.",
    "how_this_build_will_embody_it": "Milestone NAMES are what a rep collects. Two badges for one achievement under different names is not a cosmetic duplicate — it is the product telling someone they did a thing twice." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-256", "read_at": "2026-09-21T16:40:00Z",
    "why_it_governs": "Audit ground-up, in the outside-view stance, producing honest flags on the record — flags inform but do not block.",
    "how_this_build_will_embody_it": "This IS an audit under §1.7, and it obeys the last clause: five flags raised, none of them blocking, two of them explicitly the founder's to resolve." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-280", "read_at": "2026-09-21T13:52:00Z",
    "why_it_governs": "Surface, do not overtake: default to proposing and explaining rather than silently rewriting.",
    "how_this_build_will_embody_it": "The founder's competition rule is scoped, not rewritten. The milestone overlap is diagnosed and left unresolved. Both are surfaced with the evidence rather than settled by the agent." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-190", "read_at": "2026-09-21T13:55:00Z",
    "why_it_governs": "A silent dependence is the defect; prefer failing where a human will see it over failing quietly.",
    "how_this_build_will_embody_it": "The rubric sheet depended silently on the Scoreboard meaning the same thing by 'leaderboard'. Nothing would ever have errored — a rep would simply have read two numbers and drawn their own conclusion." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Data-as-asset: nothing is discarded, and past reasoning is reusable material.",
    "how_this_build_will_embody_it": "The dense-ranking mistake is kept in the build record rather than quietly corrected, because it is the evidence that the other seven rows were read — and a wrong claim about an authority, made while writing a map of authorities, is the most useful thing in the file." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-394", "read_at": "2026-09-21T14:50:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation; surface the evidence.",
    "how_this_build_will_embody_it": "Milestones are this clause's main instrument — the visible proof a rep is getting better. Two badges for one achievement turns that proof into something they have to reconcile rather than read." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-21T15:55:00Z",
    "why_it_governs": "A method counts as learned only when measured against the ALTERNATIVE, on real problems; a fluent novel-sounding method with no validated result is not learning.",
    "how_this_build_will_embody_it": "Two scoring systems now run side by side, which is the alternative this clause asks for — but only if they are compared. Today they would be compared by a rep noticing two different numbers, which is not measurement. The map is the precondition for doing it deliberately." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "One decision, one source; duplicated conditions drift invisibly.",
    "how_this_build_will_embody_it": "The clause this whole map serves. Its usual scope is a code condition; here it is applied to every NUMBER a product shows a person, which is where the same failure is visible to a user rather than only to a test." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T13:26:00Z",
    "why_it_governs": "Guide, do not overtake — never take over the solution, and make the human a participant.",
    "how_this_build_will_embody_it": "Rewriting the founder's rule would have been the overtake. Scoping it keeps their words and adds only the fact the product supplies." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Hard metrics must be objective and defensible.",
    "how_this_build_will_embody_it": "Two leaderboard totals under one word is the least defensible state a metric can reach. The scoping does not fix it; it stops the product asserting the wrong one as fact." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "Knowledge is not intelligence; a fast fluent answer imitates understanding convincingly.",
    "how_this_build_will_embody_it": "The dense-ranking claim is the specimen: fluent, specific, technically-worded, and wrong, produced by knowing what ranking functions usually do instead of reading this one." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "A decision for the founder is a picker with a recommendation, never a quiet default.",
    "how_this_build_will_embody_it": "Two rows are explicitly marked FOUNDER DECISION rather than defaulted — which board the nav shows, and what happens to the overlapping milestones." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Labels without content produce work in the language of the discipline that violates it.",
    "how_this_build_will_embody_it": "'First pitch' and 'First pitch scored' are the same achievement wearing two labels — the failure at the level of what a product says rather than what it computes." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "Seven rows read, one recalled, one wrong — and it was the recalled one. The check.md table names which file was opened for each row." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A lesson in prose returns; encode it in a gate.",
    "how_this_build_will_embody_it": "Honoured in the breach, and the build says so: this is prose, it will go stale, and A33 is why it is not a gate. What is gated is the one collision already found — the band cross-check test." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-858", "read_at": "2026-09-21T13:56:00Z",
    "why_it_governs": "A gate must be PRECISE or not exist; when the pattern resists detection, keep the prose and decline.",
    "how_this_build_will_embody_it": "The clause that decides this is a document. No precise detector exists for 'these two numbers mean the same thing to a human', and an imprecise one would flag every integer in the tree. Declining to gate is the instruction, not a compromise." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual is the highest-yield queue in the audit.",
    "how_this_build_will_embody_it": "Tenth consecutive build from the previous one's residual, and R1 said in advance where the surface area was." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md lists which file was opened for each row of the map, so 'verified' names the reads rather than summarising them." }
]
```
