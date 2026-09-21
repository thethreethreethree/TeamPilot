---
started_at: 2026-09-21T21:00:00+08:00
trigger: The override API shipped an hour ago with no surface. R2 and R4 of its own closure said so — a manager could not apply a correction from anywhere, and no rep could see one. Layer 2 was done and layer 3 was not.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the half that was named as missing

## Why (the record)

The previous build's own closure states the gap in its own words:

> *"A manager cannot apply an override from anywhere. The API exists, is gated and is tested; no
> surface calls it. The dispute queue still ends at 'reply only' — the §1.5.1 layer-3 gap this
> build set out to close."*

and:

> *"The rep-visible log is the SPECIFIED result (rubric p.7, 'with the change logged'), so per
> §1.5.4 it binds at layer 2, not layer 4. The data now travels to the component and stops there."*

Both were written deliberately rather than discovered later, which is the only thing that makes
them recoverable. This build is the other half.

## The contradiction I had to resolve before writing a line

`DisputeQueue.tsx` opened with a prohibition **I wrote this morning**:

> *"WHAT IT DELIBERATELY CANNOT DO: change a score. … If replying could adjust points, the
> leaderboard would become quietly editable by whoever handles the most complaints, and the number
> would stop meaning anything."*

The founder's picker answer and the rubric PDF (p.7) both say the opposite. The founder's standing
instruction on this workstream is *"MAKE SURE THAT THE SYSTEM IS BUILT LOGICALLY, SO CONTRADICTION
IS NOT APPLIED BUT NOTED"* — so the prohibition was not deleted. It is kept in the file as a
SUPERSEDED CONSTRAINT with its reasoning, and recorded in full as section K of
`LOGIC-AND-CONTRADICTIONS.md`.

**Why the original argument was sound and its conclusion still wrong.** The load-bearing word is
**quietly**. The fear is real; refusal is one answer to it and an audit trail is a better one. Once
the log is append-only, the reason is required, the rep reads it, and the recompute runs through
the same scorer, the edit is the opposite of quiet. A system that *cannot* correct a score it knows
is wrong has not avoided dishonesty — it has moved it from the edit to the number.

**The half that did not change:** replying alone is still score-neutral, and the card still says
so. That sentence was never about mistrusting managers; it is about a manager who replies "you're
right", assumes the score followed, and leaves the rep's number wrong.

## The shape of this class, which is new to the record

Sections G-J of the contradictions log are all **duplicated decisions that agreed when written and
drifted later**. This one is different: a decision that **never had an authority at all**. I wrote
a prohibition from first principles, it read as reasoned, and it sat in the tree looking exactly
like a ratified constraint.

An invented constraint is harder to catch than a duplicated one, because nothing disagrees with it.
The only test that separates them is whether the rule names a **source**. *"The rubric PDF, page
7"* is a source. *"If replying could adjust points…"* is an argument. In a docblock they look
identical.

## Workflow, traced before building (§1.5.1 layer 3)

**Manager.** Reading a dispute they agree with, note already typed. The correction must be possible
*there*, not behind a navigation — and it must reuse the note, because a separate "reason" field
next to a reply box is how a required field becomes "asdf". The reason is the one sentence the rep
will read.

**Rep.** Opens a pitch and sees a number they do not recognise. The explanation has to be **above
the fold**, not filed under the dispute thread: a number that changed without a visible reason is
indistinguishable from a number that was wrong all along, and the second reading is the one that
costs trust.

**The correction must not be gated on a dispute existing.** A manager can listen back and correct a
pitch nobody complained about — and that is precisely the correction a rep would otherwise never
learn about.

## Session-read manifest

```json
[
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T21:02:00Z",
    "why_it_governs": "Four layers, foundation up. A feature that works in itself but breaks workflow continuity is incomplete and must not ship.",
    "how_this_build_will_embody_it": "This build IS the layer-3 close of the previous one. The workflow was traced in both directions before any JSX: what the manager is doing when they need the control, and what the rep is looking at when they need the explanation." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T21:03:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2 and cannot be deferred as layer-4 polish.",
    "how_this_build_will_embody_it": "The rubric specifies the change is logged. The rep-visible correction row is therefore the result, not presentation of it — which is why it was built now rather than filed as polish, and why it renders above the section breakdown rather than at the bottom." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-21T21:04:00Z",
    "why_it_governs": "Consume the verdict; never re-derive a decision from the raw inputs an authority already judged.",
    "how_this_build_will_embody_it": "Twice. The item's KIND is asked of the rubric maps rather than parsed from the id prefix — splitting on the dot works today and would silently mis-offer controls the day a prefix changes. And the grade labels in the correction row are DERIVED from GRADE_STYLE rather than retyped, so a renamed grade cannot leave the badge and the row calling one thing two names." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T21:05:00Z",
    "why_it_governs": "Guide, don't overtake. The human's call stays the human's.",
    "how_this_build_will_embody_it": "The superseded constraint is the case in point: my own reasoned prohibition lost to the founder's explicit decision plus the spec, and it lost on the record rather than by quiet deletion." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-21T21:06:00Z",
    "why_it_governs": "Append-only; the record stays intact.",
    "how_this_build_will_embody_it": "Applied to the DOCUMENTATION as well as the data. The previous build's closure said 'no UI'; that record was not edited to pretend otherwise. This is a separate build directory that closes R2 and R4 by name." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-21T21:07:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "The hypotheses were written before the components were opened: offering a correction where none can be made, a reason that becomes 'asdf', and a partial failure between the two writes. All three became tests; the third became the build's most interesting state." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-21T21:08:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "Applied to two green mutation runs. Both had a survivor, and in both cases the convenient reading was 'equivalent mutant'. Neither was — one test pinned a single grade out of three, the other never sent a bonus." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-21T21:01:00Z",
    "why_it_governs": "Understanding precedes solving; if you cannot articulate why the problem exists you may not solve it yet.",
    "how_this_build_will_embody_it": "The problem was not 'add a button'. It was that the previous build had named its own gap precisely, and building from that naming rather than re-deriving it is what kept this build to the two surfaces actually missing instead of a redesign." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T21:13:00Z",
    "why_it_governs": "The methodology defining the work must be in the working tree at the moment of action; citing labels from a document not in the tree is forbidden.",
    "how_this_build_will_embody_it": "Load-bearing here. The rubric PDF IS in docs/SYSTEM UPDATES AND REVISION/ and was read, which is the only reason my invented prohibition (F4) could be checked against anything. Had page 7 lived outside the tree, the constraint would have stood." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-21T21:14:00Z",
    "why_it_governs": "Retrospective Identification — identify the problem from the record, and detect patterns across incidents.",
    "how_this_build_will_embody_it": "The record used was the previous build's own residual, which named R2 and R4 in advance. The pattern across the day's incidents — five decisions made away from their authority — is what made F4 legible as an instance rather than a one-off." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-21T21:15:00Z",
    "why_it_governs": "Outside-Perspective Identification — no stake in the existing assumptions, no sunk cost.",
    "how_this_build_will_embody_it": "Applied to my own morning's work. The prohibition in DisputeQueue.tsx was mine and reasoned; the outside reading is that it never had a source, which is a different and worse fault than being wrong." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-21T21:16:00Z",
    "why_it_governs": "Holistic — trace what else a change affects before making it.",
    "how_this_build_will_embody_it": "Traced: removing 'Re-score the pitch if the grade was wrong' breaks a test that asserted it, and that test encodes the superseded rule. It was updated with the reason beside the assertion rather than deleted, so the next reader finds why." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-21T21:17:00Z",
    "why_it_governs": "A feature depending on config outside the repo is incomplete until that precondition is verified or documented.",
    "how_this_build_will_embody_it": "Checked and does not bind: both surfaces call routes already deployed in this repo, with no dashboard setting, allowlist, DNS or webhook behind them. Recorded as not-applicable rather than left unexamined." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-21T21:18:00Z",
    "why_it_governs": "Ground-up auditing — a problem at layer N propagates to every layer above it.",
    "how_this_build_will_embody_it": "F1 is the clearest example the day produced: a data-layer field added at the bottom took out the entire pitch panel at the top, and it surfaced through six failures in a component this build never touched." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-21T21:19:00Z",
    "why_it_governs": "Diagnose before patching; surface, don't overtake.",
    "how_this_build_will_embody_it": "F1 was diagnosed before it was fixed — the failures said 'cannot read length of undefined' and the tempting patch was the test fixture. The fixture was the symptom; the cast across the JSON boundary was the cause, and the guard went in the component." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T21:20:00Z",
    "why_it_governs": "Measure downstream consequence, never agreement.",
    "how_this_build_will_embody_it": "Bears on what the override log will later be read FOR. The manager's correction is a disagreement with the model, and the honest instrument is what gets corrected and how often — not whether reps accept scores. Nothing reads it that way yet; that is future work, not a claim." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-21T21:21:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "The reason the rep's correction row sits above the fold rather than under the dispute thread — and the reason R2 (nobody is notified) is rated the lowest-confidence residual in the file." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-21T21:22:00Z",
    "why_it_governs": "A method counts as learned only when measured against the alternative; distrust your own evolution until results prove it.",
    "how_this_build_will_embody_it": "Applied to two mutation runs that each had a survivor. Both times the convenient reading was 'equivalent mutant'; both times it was a real gap, and the difference was checking rather than concluding." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-21T21:23:00Z",
    "why_it_governs": "The pre-action checklist; item 0 routes every founder decision through a picker.",
    "how_this_build_will_embody_it": "No new founder decision arose in this build — the override decision was taken in the picker before the previous one. Item 1a is why this manifest exists." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-21T21:24:00Z",
    "why_it_governs": "Migrations are safe-to-re-run by construction.",
    "how_this_build_will_embody_it": "Does not bind: this build adds no migration. Stated rather than silently skipped, because the commit range touches a feature whose migrations shipped an hour earlier." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-21T21:25:00Z",
    "why_it_governs": "Methodology governing the build must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "The operative asset here was the rubric PDF rather than a constitutional one, and it was in the tree. R6 carries the standing exception: the 2026-09-19 instruction image still cannot be opened." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-21T21:26:00Z",
    "why_it_governs": "Audits within modules miss same-name-different-feature failures across them; the user experiences a feature concept, not a module boundary.",
    "how_this_build_will_embody_it": "Directly why R7 is rated as it is. A manager can now move a Pitch Score while the rank surface still orders reps by the gamification system — one concept, two orderings, which is A21's exact shape and is now reachable by a button." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-21T21:27:00Z",
    "why_it_governs": "Citing an asset without reading it in-session is A19 operating undetected; the manifest is the artifact that closes the gap.",
    "how_this_build_will_embody_it": "This block. The gate named each of these as cited-but-unmanifested and they were opened in response, which is the forcing function working rather than the author's diligence." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-21T21:09:00Z",
    "why_it_governs": "A lesson recorded only in PROSE will return; a fix is not complete until the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Every finding here is answered by a test that fails when the defect returns, including the rollout-skew crash — which is pinned by a fixture with the field DELETED rather than by a comment asking the next author to be careful." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-21T21:10:00Z",
    "why_it_governs": "Schema-complete is not built; the seam between the database and the surface is where a correct system silently becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "This build is the seam. The previous one closed the read path into the data layer and stopped, which A31 names exactly — and F1 here shows the seam has a second edge: the data reached the component and the component could not survive receiving it from an older server." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-21T21:11:00Z",
    "why_it_governs": "'Verified' is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md pastes outputs with exit codes, and states which mutations were run, which survived, and what the survivors turned out to be." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-21T21:12:00Z",
    "why_it_governs": "The operational lesson behind §2.2 — a dropped term in a duplicated condition silently defeats a gate.",
    "how_this_build_will_embody_it": "Why `itemKindOf` asks the rubric instead of splitting the id: a prefix parser is a second definition of what makes something a bonus, and it would agree with the rubric on the day it was written." }
]
```
