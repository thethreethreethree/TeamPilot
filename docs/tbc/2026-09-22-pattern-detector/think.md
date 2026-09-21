---
started_at: 2026-09-22T04:43:00+08:00
trigger: Founder ruling, three parts — keep the 153 annotated records, build the Pattern Interrupt detector next, and "open" means anything not Fixed. The screen has shipped as an honest empty state; this is the half that fills it.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the detector, and the two definitions it rests on

## Why now, and why it was refused before

Yesterday's build shipped Pattern Interrupt's screen saying the comparison had not been built, and
declined to build it. The refusal had two reasons and the founder has now removed one of them:

1. `patterns` and `pattern_events` do not exist — migration 0252 deferred them to ship with this
   feature. Still true; this build creates them.
2. **"Open" had two definitions.** The manager chips and the rep-detail panel count Improving as
   open (Anthony A. = 3); the rep-progress list excludes it. Building over that ships two numbers
   for one rep on two screens. **Ruled: `open = status ≠ Fixed`.**

Worth recording plainly: `LOGIC-AND-CONTRADICTIONS.md` C8 had already written that exact rule
before the question was asked. The ruling ratifies the record rather than overriding it, so the
detector implements what the sweep had already concluded and the founder has now made binding.

## The definitions this build must not invent

Three were decided before this session and are read from the record, not re-derived:

- **C4 — the strip is applicable-only.** `strip = last min(10, applicable)`. A pitch where the
  element did not apply is skipped entirely, never padded. The mockups show seven dots reading
  "5 of 7". Padding to ten would open a false pattern on every early-career rep.
- **B4 — a Partial is not a miss, but that is a parameter.** *"Detection takes the grade predicate
  as a parameter defaulting to `grade === 'missed'`. Flipping it to include Partial is a one-line
  change, and the choice changes how many patterns open for every rep in the product."* Built
  exactly that way: exported, named, defaulted, and not decided by burying it in a comparison.
- **C8 — `open = status ≠ Fixed`**, and the rep-progress list's third number must be *labelled*
  "open and not yet improving" rather than called "open".

"Applied" needs no new column. `pitch_score_elements` has `unique (pitch_id, element_id)` and a row
exists only when the element was graded, so applicability is row presence. The index
`(company_id, element_id)` was created in 0252 with the comment *"Pattern detection will scan the
last 10 pitch_scores where this element applied"* — the read this build needs was anticipated by
the migration that deferred it.

## The part that is not the detection

Counting three misses in ten is arithmetic. Two things are not.

**The status is a decision with five outcomes and it must have ONE author.** New → Coaching →
Improving / Stalled → Fixed, with automatic transitions (five clean applicable pitches clears it;
coached 7+ days ago with no streak and no improvement is Stalled) and manual ones (a manager
starts coaching). Five surfaces will want to know the status and whether the pattern is open.

§2.2 is the whole design here: the status resolver returns a **verdict** — the status, `open`, and
the reason — and every consumer branches on it. No surface computes `status !== "fixed"` for
itself. That derivation is one line, which is exactly why it would get copied, and a copy that
drifts is how the C8 contradiction would come back after being ruled on. The single most likely
way to lose this ruling is not to disagree with it; it is to reimplement it correctly four times
and incorrectly once.

**A detected pattern is an event, not a row to edit.** §3.1: append-only, state derived by
replaying. So `patterns` holds identity plus the facts frozen at detection, and `pattern_events`
holds what happened to it — coached, noted, fixed, reopened. Nothing updates a status column,
because there is no status column; there is a function over events and recent grades.

That also answers "cost". The docblock inherited from the mockups says *average points lost per
applicable pitch, frozen at detection, becoming points recovered once fixed.* Frozen means stored
at detection and never recomputed — a pattern detected under one rubric must not silently re-cost
itself when the rubric changes, for the same reason `pitch_scores` stores its components rather
than recomputing them on read.

## What could go wrong, before I look

1. **`open` re-derived at a surface** — the ruling defeated by a copy, which is the exact §2.2
   class this session has found seven times.
2. **Padding the strip to ten** — a false pattern for every new rep (C4).
3. **Partial silently counted as a miss**, or silently not — either is fine, undocumented is not
   (B4).
4. **Fixed computed over calendar pitches rather than applicable ones** — five clean pitches where
   the item never came up is not five clean pitches.
5. **Detecting a pattern that is already open**, so a rep accumulates duplicates of the same miss.
6. **Improving and Stalled both true**, or neither, on the same inputs — a five-state resolver with
   overlapping conditions.
7. **The team-wide promotion (3+ reps on one item) counting a rep twice** through two patterns on
   the same item.
8. **RLS letting a rep read another rep's pattern** — 0252's access rule is "reps only ever see
   their own patterns and recordings", and it is the launch checklist's last line.

## What the boards changed, after this THINK was written

Everything above was written at 04:43, before the founder renamed the reference folder to
`SYSTEM UPDATES AND REVISION 09-22-2026` and made it binding — and before the two JPEGs in it
opened for the first time in twenty-two builds. The thinking is left as it was written; this
section is what reading the sources then corrected, because the difference is the point.

**The event vocabulary was invented.** Above I wrote *"coached, noted, fixed, reopened"*. The
guide's page-2 data model names six and they are not those: `coached, drill_assigned, note,
rep_reviewed, clip_disputed, fixed`. Three of the ones I had not thought of are load-bearing on
screens already drawn — `drill_assigned` is the Ⓓ marker on the Rep progress timeline,
`rep_reviewed` is the Ⓡ marker AND the entire AWAITING REP REVIEW count, `clip_disputed` is the
rep's "This clip looks wrong". A CHECK constraint with my five would have had nowhere to write
three of the board's own actions.

**The Improving rule was wrong.** I had it as "miss rate since coaching, against the rate frozen
at detection" — a reasonable measurement. The guide says *"miss rate in the last 5 applicable
pitches is lower than the first 5, and at least one clean pitch"*, and the Rep progress board
prints exactly those two figures in a column headed MISSES THEN → NOW, reading `4/5 → 1/5 ▼`.
The measurement I chose was not on the screen anywhere.

**Stalled was missing a term.** "Coached 7+ days ago, **no clean streak**, miss rate not improved."
I had the first and third.

**`first_seen` and `rubric_version`** are in the guide's field list and were not in my table.

**The `status` column is not a divergence.** The guide lists one on the table and its Step 5 heading
reads *"Statuses (drive them from data and pattern_events)"*. Deriving satisfies both, and a stored
copy would be the §2.2 duplicated decision this build is otherwise careful about.

The pattern in all four: I had reasoned from the deferral note in 0252's header and from C4/B4/C8
in the contradictions record — real sources, read this session — and reconstructed the rest. Every
reconstruction was plausible and four of them were wrong, which is §5 exactly: the confident answer
that arrives too quickly, on a document that was in the tree the whole time.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T04:44:00+08:00",
    "why_it_governs": "Understanding precedes solving; a misdiagnosis fed more capacity is an error loop.",
    "how_this_build_will_embody_it": "Three definitions this detector depends on were settled in the record before this session. They were read out of it rather than re-derived, and one of them turned out to already say what the founder was about to rule." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T04:44:30+08:00",
    "why_it_governs": "The methodology governing the work must be in the tree and consulted at the moment of action.",
    "how_this_build_will_embody_it": "LOGIC-AND-CONTRADICTIONS.md B4, C4 and C8 were opened and read this session before any of the three was implemented. The build guide's Step 5 shape was read from 0252's own header rather than recalled." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-09-22T04:45:00+08:00",
    "why_it_governs": "Holistic — trace the ripple; never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "Two new tables under an existing RLS predicate, a new read over an index 0252 created for it, and a screen that currently renders zeros unconditionally. Each traced before writing." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T04:45:30+08:00",
    "why_it_governs": "Four layers, foundation up; a feature that passes layers 1-3 but stalls the user is incomplete.",
    "how_this_build_will_embody_it": "Layer 1 is the append-only shape; layer 2 is whether a pattern a rep actually has appears on their screen; layer 3 is whether finding one leaves a manager able to act, which is why coaching is an event the screen can write rather than a status someone edits elsewhere." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T04:46:00+08:00",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Eight hypotheses written before the first line. The ones that shaped the design are the re-derived `open` and the five-state resolver with overlapping conditions." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-22T04:46:30+08:00",
    "why_it_governs": "A decision is returned as a verdict and consumed, never re-derived from the same raw inputs; duplicated conditions drift and one dropped term defeats the gate.",
    "how_this_build_will_embody_it": "The clause this build is mostly made of. `open` is a field on a verdict, not an expression a surface writes. The founder has just ruled on a definition that two screens already disagreed about — the way to lose that ruling is to implement it five times." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T04:47:00+08:00",
    "why_it_governs": "Everything is an event, append-only; entity state is derived by replaying, never edited directly.",
    "how_this_build_will_embody_it": "There is no status column. `patterns` holds identity and the facts frozen at detection; `pattern_events` is the append-only log; status is a function over the log and the recent grades." },

  { "id": "§3.2", "source_file": "CLAUDE.md", "line_range": "347-351", "read_at": "2026-09-22T04:47:30+08:00",
    "why_it_governs": "A problem may not be surfaced to a human until it links to a minimum threshold of supporting signals; the schema encodes the bottleneck.",
    "how_this_build_will_embody_it": "Three misses in ten applicable pitches IS this clause for this feature — the threshold below which a repeated miss is a bad day rather than a pattern. It is stored with the pattern, so a surfaced pattern carries the evidence that qualified it." },

  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-363", "read_at": "2026-09-22T04:48:00+08:00",
    "why_it_governs": "Guide, don't overtake; make the human a participant so an accurate but unwelcome finding is survivable.",
    "how_this_build_will_embody_it": "A pattern is a claim about a person, shown to their manager. The clips are the evidence, the rep sees the same page, and the status cannot advance to Coaching without a human doing the coaching — the system detects, it does not conclude." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T04:48:30+08:00",
    "why_it_governs": "The pre-action checklist, including item 0 on decisions belonging to the founder.",
    "how_this_build_will_embody_it": "Two decisions were put in a picker before building rather than after: what 'open' means, and whether to build this at all. B4's Partial question is the one still open, and it ships as a named parameter rather than as a quiet choice." },

  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-310", "read_at": "2026-09-22T04:49:00+08:00",
    "why_it_governs": "A migration is a replayable description of intended state; every DROP needs IF EXISTS, every CREATE that names something needs IF NOT EXISTS, because the next author replays against a partially-applied database.",
    "how_this_build_will_embody_it": "0258 is idempotent throughout and verified by re-applying it against real Postgres, not by reading it. The 18 landmines defused yesterday were all this class." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-479", "read_at": "2026-09-22T04:49:30+08:00",
    "why_it_governs": "Methodology in the tree, read in session, never cited from cached labels.",
    "how_this_build_will_embody_it": "The three definitions are quoted from the record with their section ids, having been opened this session. Yesterday's build found the cost of the alternative: a note about two tables, written from the guide, wrong about both names." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-593", "read_at": "2026-09-22T04:50:00+08:00",
    "why_it_governs": "Audits within modules miss same-name-different-feature failures across them; one manager definition, not two.",
    "how_this_build_will_embody_it": "Directly load-bearing twice. The RLS uses 0252's existing `is_sales_coach_manager()` rather than a second predicate, and 'open' is the same word meaning two things on two screens — which is A21's exact shape, caught in the mockups before it reached code." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-644", "read_at": "2026-09-22T04:50:30+08:00",
    "why_it_governs": "Citations without session-reading operate undetected; the manifest closes the gap between citing and reading.",
    "how_this_build_will_embody_it": "B4, C4 and C8 are cited above with their text, read this session. Two of the three said something more specific than I remembered — B4 specifies a parameter, not a choice." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T04:51:00+08:00",
    "why_it_governs": "A lesson in prose returns; encode the class in a gate that fails without the author's cooperation, and keep the gate quiet enough to be heeded.",
    "how_this_build_will_embody_it": "C8's ruling is prose today. The gate for it is structural rather than a checker: if `open` exists only as a field on a returned verdict and never as an expression, a surface cannot disagree with the ruling without deleting something." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-819", "read_at": "2026-09-22T04:51:30+08:00",
    "why_it_governs": "Schema-complete is not built; the seam between the database and the surface is where a correct system silently becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "The exact risk here. Two tables, a detector and a status resolver can all be correct while the screen still renders four hardcoded zeros — which is what it does today. The build is not done until a detected pattern appears on it." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-22T04:52:00+08:00",
    "why_it_governs": "\"Verified\" names a command you ran; report coverage rather than a verdict.",
    "how_this_build_will_embody_it": "`npm run check` by name with Postgres reachable, plus migration:audit proving 0258 re-applies, plus mutation runs on the two pure modules." },

  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "Retrospective Identification — identify the problem by looking backward at the actual record of what happened, and detect patterns across incidents rather than the symptom in front of you.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. The method of the whole build. The symptom was one wrong timestamp; the record — 319 dirs paired with their own commit dates — turned it into a two-month pattern with two distinct causes." },

  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "Outside-Perspective Identification — read the problem as a detached observer with no stake in the existing assumptions.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. The records under audit are my own from earlier today. The outside reading is that the author had an incentive to inflate the field and did so 25 times in a row; the inside reading would have been that each individual timestamp was approximately right." },

  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "A feature depending on state outside the repository is not operationally complete until that precondition is verified end-to-end or documented as a blocking step; prefer failing loud over failing silent.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. Adjacent rather than central, and it is why the gate anchors on git rather than on the clock: the machine's time is state outside the repository, and a check that a false record stops failing once the clock passes it is the silent-dependence shape this clause names." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "A user-specified experience binds at layer 2 and cannot be deferred as layer-4 polish; under-delivering while reporting complete is as much a violation as overtaking.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. The reason the breakdown notice shipped with wording rather than as a bare boolean. It is also the clause that makes R1 uncomfortable: a fourth callout on an unseen board is a surface decision taken without the person who specified the surface." },

  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-263", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "Audit ground-up from the most foundational layer; a problem at layer N propagates to every layer above it, and an empty flag list is itself suspicious.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. started_at sits below every TBC gate — it decides which record is even looked at — so a defect there propagates to all five. The gates had been reporting success for two months over records half of which were false, which is exactly the suspicious-green this clause warns about." },

  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-306", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "How the agent must behave: diagnose before patching, no error loops, interrogate locked doors, surface rather than overtake, explain the why, trace interconnections.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. Diagnose-before-patching is the load-bearing one. The first patch I reached for was 'reject a future date', which would have fixed eight records and mis-described seventy-four." },

  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "Measure downstream consequence, never agreement; measuring the thing that is easy to count instead of the thing that matters is grading your own homework.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. The gates were being graded on whether they exited 0, which they did throughout. Consequence — whether the record they validated was the record being written — was not measured by anything until this build." },

  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-397", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "Make learning visible; adaptation nobody can perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. Why the 153 allowlist entries carry their measured overshoot and their cause instead of a shared sentence. A silenced check records that someone silenced it; an annotated one records what was found." },

  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-415", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "A method counts as learned only when measured against the alternative on real problems; a fluent novel-sounding method with no validated result is the knowledge-imitating-intelligence trap one level up.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. Both halves of the fix were measured against their alternative rather than argued for: the mutation runs are the before/after, and M4 survived the first pass, which is how the tier turned out to be load-bearing rather than decorative." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T04:53:00+08:00",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident answer that arrived too quickly; the biggest risk is the builder under pressure making the method less honest for a faster result.",
    "how_this_build_will_embody_it": "Re-read this session before the boards were opened, and cited again in this session's commit messages. The literal finding. Under a continuous-build mandate the honest move — write the clock reading — cost the build its own validation, so the dishonest one was also the only one that worked. That is §5's builder-under-pressure with the pressure supplied by the gate." }
]
```
