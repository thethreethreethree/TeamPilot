---
started_at: 2026-09-22T07:30:00+08:00
trigger: R1 of the ruling's closure — the founder ruled generally that the KPI document wins on anything a rep sees, and I applied it only to the three calls I had already made. Nothing had swept the rest.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — I had been quoting one line of a document I had not read

## Why (the record)

The ruling's own closure, written hours earlier:

> *"The founder ruled generally: the KPI document wins on anything a rep sees. I applied it to the
> three calls I had already made. Nothing swept the product for other places the sheet and the KPI
> document disagree. … OPENED, and it is the most likely place for this to recur."*

It recurred immediately, and worse than predicted.

## What the sweep found, and what that says about the four builds before it

**The gamification Scoreboard served every rep a fully ranked board with names.** Its own docblock
said so — *"Every company member may view it."* — and the nav entry is not `managerOnly`. It has
been that way since it was built.

The part worth sitting with: **I had restricted the Pitch Score board that same morning and then
mounted it on the same page as an unrestricted one.** A rep opening `/scoreboard` would have seen
their own standing with no rank, carefully withheld, directly above every colleague's name and
total. The restriction was undone one section below itself, by me, hours apart.

**And I had been quoting one line.** The KPI document's ranking sentence appears in four of my
documents. Its §4 Reporting Surfaces, which I had never opened, says of the agent view:

> *"the agent's own KPIs, each shown against their own baseline and trajectory. Growth-framed —
> lead with what improved, then growth areas, per the coaching philosophy. No cross-agent ranking
> here."*

Three obligations in one sentence, of which I had been honouring a fraction of one. The Breakdown
board opens on BIGGEST OPPORTUNITY — a deficit — which is the opposite of the ordering that clause
asks for.

This is A22's failure with a product document and with a twist: not citing without reading, but
reading ONE SENTENCE and citing the document.

## The thing that worked, and it was a decision made yesterday

`RepArena` prints `rank #N` on the rep's own dashboard, read from the leaderboard's `meRank`. I did
not fix it. It fixed itself, because the gate went in the ROUTE rather than in the `Scoreboard`
component — the Arena stopped receiving a rank and its `?? null` did the rest.

Had I gated the component, the Arena would still be ranking reps on the default view, and nothing
in this sweep pointed at it directly. That is §2.2 paying rather than being argued: one authority,
one place, and every consumer corrected at once.

## What could go wrong, before I look

1. **A filtered board instead of no board** — the tempting middle, and a board of one is a wrong
   board.
2. **Gating the component instead of the route**, which fixes one surface and leaves the others.
3. **Leading with a strength that is a thing the rep has never done** — an unattempted element has
   the largest gap to its ceiling and would win a naive smallest-gap pick.
4. **Removing the opportunity** rather than reordering. Growth areas follow strength; they do not
   vanish.

All four became mutations.

## Session-read manifest

```json
[
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-22T07:32:00Z",
    "why_it_governs": "Citing an asset without reading it in-session is A19 operating undetected; the labels propagate through commits and comments far faster than the content propagates through reading.",
    "how_this_build_will_embody_it": "The exact failure with a product document, in a new shape: I read ONE SENTENCE of SalesCoach-KPI-System.md, quoted it accurately in four documents, and never opened §4, which contains two further obligations about the agent view. A partial read cites like a full one." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-22T07:33:00Z",
    "why_it_governs": "An authority computes a decision and returns a verdict; consumers branch on it and never re-derive it, because duplicated conditions drift.",
    "how_this_build_will_embody_it": "Demonstrated rather than asserted. The gate went in the route, and RepArena — a surface this sweep had not reached — stopped showing a rank without being edited. Gating the component would have fixed one screen and left two." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-22T07:34:00Z",
    "why_it_governs": "Periodically, and before any major structural change, audit from the simplest foundation up; produce honest flags; an empty flag list at a layer is itself suspicious.",
    "how_this_build_will_embody_it": "This build IS a §1.7 audit with a single lens — the KPI document — walked across every rep-facing surface. The flags are honest, including the one that is mine and unfixed." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-22T07:35:00Z",
    "why_it_governs": "Guide, don't overtake; the human's call stays the human's.",
    "how_this_build_will_embody_it": "The ruling is the founder's and this build applies it rather than re-deciding it. Where it could not be applied literally — lead with what IMPROVED needs a baseline this board lacks — the approximation is labelled as one instead of being presented as compliance." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-22T07:36:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation; surface evidence that the system knows the team better than it did.",
    "how_this_build_will_embody_it": "Why the withheld board says WHY rather than rendering empty, and why the strength callout exists at all: a board that only ever names a deficit tells a rep nothing has improved, whatever the numbers say." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T07:37:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm; search for adjacent problems, because a bug rarely lives alone.",
    "how_this_build_will_embody_it": "The clause's second half is the whole build. The ruling was one bug; the sweep looked for its neighbours and found three, one of which I had created that morning." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T07:31:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The problem was not 'one board ranks reps'. It was that a general rule had been applied to three specific cases, which is the shape that leaves the oldest violations standing — they are the ones nobody is currently looking at." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T07:38:00Z",
    "why_it_governs": "The methodology defining the work must be in the working tree at the moment of action, and citing labels from a document not consulted is forbidden.",
    "how_this_build_will_embody_it": "The document was in the tree the whole time and I had opened it for one line. Having the source and consulting part of it is a distinct failure from not having it, and the clause covers both." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-22T07:39:00Z",
    "why_it_governs": "Retrospective Identification: work from the record and detect patterns across incidents.",
    "how_this_build_will_embody_it": "The record is my own closure predicting this recurrence in the same words. The pattern across six builds — fixtures that cannot fail — also got two more instances here." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-22T07:40:00Z",
    "why_it_governs": "Outside-Perspective Identification, with no sunk cost in the existing choices.",
    "how_this_build_will_embody_it": "The outside reading of /scoreboard as it stood this morning: a rep's own standing, carefully stripped of its rank, sitting directly above every colleague's name and total. Read that way the restriction was theatre." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-22T07:41:00Z",
    "why_it_governs": "Holistic — trace ripple effects; never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "Changing a shared route breaks every existing test of it. Seven failed, all fixtures, each updated with a manager mock rather than by weakening an assertion." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T07:42:00Z",
    "why_it_governs": "Four layers; a feature that works in itself but breaks workflow continuity is incomplete.",
    "how_this_build_will_embody_it": "Removing a board from a rep's view could have left them at a dead end. The withheld state points them at their own dashboard, which is where the same document says their numbers belong." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-22T07:43:00Z",
    "why_it_governs": "External-config completeness.",
    "how_this_build_will_embody_it": "Does not bind: no config outside the repo. The gate uses an existing helper and an existing role column." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T07:44:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2.",
    "how_this_build_will_embody_it": "Both documents are user-specified and the founder has now ordered them. The strength-before-gap ordering is the KPI document's specified experience, honoured as far as the data allows and labelled where it falls short." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-22T07:45:00Z",
    "why_it_governs": "Diagnose before patching; trace interconnections before committing.",
    "how_this_build_will_embody_it": "The diagnosis is that I had been quoting a sentence rather than reading a section. Patching the one board would have left the framing violation in place and the document still half-read." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T07:46:00Z",
    "why_it_governs": "Append-only; the record stays intact.",
    "how_this_build_will_embody_it": "Does not bind to the code. Applied to the record: the ruling's closure predicted this and is not edited; this build closes its R1 by name." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T07:47:00Z",
    "why_it_governs": "Measure consequence, not agreement; frame and instrument by causal order.",
    "how_this_build_will_embody_it": "Strength-before-gap is the same argument one level up: a board that only names deficits measures a rep against a ceiling, and the document's growth-framing is about what the number is FOR." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-22T07:48:00Z",
    "why_it_governs": "Validated against the alternative, not asserted.",
    "how_this_build_will_embody_it": "Both wrong implementations of the strength pick are encoded as mutations — highest raw points, and counting an unattempted element — rather than argued against in the docblock." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T07:49:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly; the biggest risk is the builder under pressure.",
    "how_this_build_will_embody_it": "Quoting one sentence four times FELT like consulting the document. That is the shape — the citation was accurate every time, which is what kept it from being questioned." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T07:50:00Z",
    "why_it_governs": "Item 0: founder decisions go through a picker.",
    "how_this_build_will_embody_it": "No new decision. The founder's ruling is general and this build applies it; the one place it could not be applied literally is recorded as a gap rather than resolved." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T07:51:00Z",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is encoded in a gate.",
    "how_this_build_will_embody_it": "Nine mutations gate the behaviour. The class — a general rule applied only where somebody was already looking — has no gate, and the only reason it was caught is that the previous closure wrote down that it had not been swept." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-22T07:52:00Z",
    "why_it_governs": "Schema-complete is not built; the seam between the data and the surface.",
    "how_this_build_will_embody_it": "Inverted twice here: removing data at the route corrected a surface nobody edited, and the withheld state exists so removal does not leave a blank panel that reads as an empty team." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-22T07:53:00Z",
    "why_it_governs": "Verified is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the run with its exit code and states plainly that the sweep covered the surfaces I could NAME, which is not the same as all of them." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-22T07:54:00Z",
    "why_it_governs": "A gate decision is returned as a verdict and consumed, never re-derived downstream.",
    "how_this_build_will_embody_it": "The Arena consumes `meRank` and does not re-derive a rank from the rows — which is the only reason withholding the field at the route was sufficient to correct it." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-22T07:55:00Z",
    "why_it_governs": "Audits within modules miss same-name-different-feature failures across them; a full audit's boundary is the product's user-visible boundary, not a module's.",
    "how_this_build_will_embody_it": "Directly the shape of F1. The Pitch Score board and the gamification board are different modules and one screen, and auditing the one I had just built told me nothing about the one beneath it." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T07:56:00Z",
    "why_it_governs": "Methodology in the working tree, read this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "The document was read in full this time — 136 lines — rather than grepped for the sentence I already knew was in it." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-22T07:57:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "Does not bind: no migration." }
]
```
