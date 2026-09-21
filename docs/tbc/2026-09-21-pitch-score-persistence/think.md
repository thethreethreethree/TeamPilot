---
started_at: 2026-09-21T12:00:00+08:00
trigger: Writing the persistence layer for the Pitch Score engine produced four defects in one sitting, all the same shape — the writer re-deciding what the scorer had already decided.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the score said 62.4 and the rows under it added to 48

## Why (the record)

This build is not a feature request. It is what happened when the last piece of Project 1 —
the thin wrapper connecting `generatePitchScore` to the `store_pitch_score` RPC — was written
the obvious way.

The obvious way is: take the model's graded elements, look each one up in the rubric, multiply
by the grade credit, and write the rows. It is twenty lines, it typechecks, and it is wrong four
separate ways. Each way produces the same end state and none of them fails anything.

The end state: **the rows on a rep's Pitch detail do not add up to the score printed above them.**

## The four

All four are §2.2 / A40: an authority (`scorePitch`) computed a decision, and the consumer
re-derived it from the same raw inputs instead of consuming the verdict.

| # | What was re-derived | What would have been stored |
|---|---|---|
| G1 | Bonus points, from the rubric's face value | A bonus the scorer **rejected** for failing the 0.80 audio-confidence floor, displayed to the rep as awarded |
| G2 | Bonus points, ignoring the ceilings | Nine detections of a repeatable +2 bonus stored as nine rows = 18 points, against a ceiling of 6 |
| G3 | Whether an element was scored at all | `Objection handling: missed` on a pitch where the customer never objected |
| G4 | Section totals, by summing the element rows | Delivery at ~77% of the figure that actually went into `base` |

**G4 is the quietest and the worst.** When no objection occurs the rubric scores the five
remaining Delivery skills out of 27 and scales them to 35. So the raw element rows sum to 27/35
of the section total that went into `base`. A Breakdown screen that adds up element rows shows a
Delivery figure that disagrees with the score on the same page — on **every objection-free
pitch**, permanently, with nothing anywhere failing. This is the A40 signature exactly: types
sound, tests green, a well-formed wrong answer.

**G3 is the one that hurts a person.** The rubric is explicit that a rep who did not face an
objection must not be credited *or* penalised for handling one. A stored `missed` grade is a
false accusation on the record, and it is the kind a rep would dispute and be unable to win.

## Why re-derivation was tempting here

Because the model returns grades and *someone* has to turn grades into points, and the writer is
holding both the grades and the rubric. The rule looks like duplication-avoidance pedantry until
you count what the scorer actually decides that the rubric alone does not: the confidence floor,
the repeatable ceiling, the pool cap, the objection exclusion, the Delivery scale factor, and
(new, below) duplicate resolution. Six decisions, none visible in the element list.

## Two further findings, not re-derivation

**G5 — a duplicate element double-counted into `base`.** The model is asked for thirty graded
elements in one answer. Listing one twice is a formatting slip, not a scoring event, and
`scorePitch` was summing both. It is also *unstorable*: `pitch_elements` is unique on
`(pitch_id, element_id)`, so the write would have failed at the very last step with the LLM call
already paid for and the score already computed — the A40 "empty-but-billed" shape at the
storage layer rather than the gate layer.

**G6 — a promise the storage layer did not keep.** `scorePitch` collects bonuses it rejected for
low confidence, and the comment states why: *"a rejected one is recorded rather than dropped
silently, so the dispute has something to point at."* Nothing stored them. A rep asking why they
did not get the inside-the-home bonus would have received the exact answer the rubric names as
insufficient — *"the AI didn't see it"* — rather than *"it heard it at 0.62, below the 0.80
floor."* That is the difference between a dispute a manager can settle and one they cannot.

G6 is A36 in miniature: the residual was written honestly into a comment, and writing it there
is what stopped anyone acting on it.

## The shape of the fix

Not "be careful in the writer." The writer cannot be careful enough, because the information it
needs is not in its inputs. `scorePitch` returns the verdicts:

- `elementBreakdown` — every element that counted, with its grade and raw rubric-weight points.
  The authority on what was scored.
- `sectionPoints` — already existed; now **stored** (`pitches.section_points`, migration 0254)
  rather than left to be re-summed.

Element rows stay at raw rubric weight so each one reads true on screen (`Tonality 1.5/3,
partial`), while the section verdict carries the scaled figure that sums to `base`. The
alternative — pre-scaling each element row — keeps the sum but makes every individual row lie
(`Tonality 3.9` against a 3-point element).

`rejected_bonus` becomes a third `pitch_events` kind, worth 0. Not a bonus (it awarded nothing)
and not a violation (it cost nothing); folding it into either makes it sum wrong in the one place
both are totalled.

## Contradiction noted, not applied

§3.1 says events are append-only — *"Never update or delete — append."* `store_pitch_score`
**deletes** `pitch_elements` and `pitch_events` when re-scoring a session.

This is a real tension and it is being recorded rather than silently resolved. The reading taken:
these rows are *scoring evidence attached to a derived artifact*, not domain events in the
`events → signals → problems → resolutions` chain §3.1 governs. A re-score is a recomputation of
the same pitch under the same rubric, and appending a second full grading would break the
"sections sum to base" identity on the very next read while leaving no way to tell which grading
is current.

What is genuinely lost: the ability to see that a pitch was re-scored, and what changed. That is
residual R1, and the right shape for it is a `pitch_score_revisions` append-only row, not a
refusal to delete the children.

## Layers (§1.5.1)

1. **Structure** — the verdict types live on the scorer's return, so the rule has one home.
2. **Effectivity** — verified against real Postgres 16, not asserted. See check.md.
3. **Composition** — this is the last link of Project 1: `generatePitchScore` → `storePitchScore`
   → `pitches`. What it does *not* yet compose with is a route; nothing calls it. Stated, not
   glossed (residual R2).
4. **Surface** — none. No UI in this build.

## Session-read manifest

Every clause below was opened in THIS session, from the file named, at the line range given.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving; a fast answer that sounded right is the thing to distrust.",
    "how_this_build_will_embody_it": "The twenty-line writer typechecked on the first try and was wrong four ways. It was not shipped because it worked; it was audited because §2.2 names the shape, and the audit is what found G1-G4." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The methodology defining understanding for this work must be in the tree AND read now; citing cached labels is the §5 failure.",
    "how_this_build_will_embody_it": "Unmet in one direction and honoured in the other. CLAUDE.md and ThinkerThinker.md are both in the tree and every clause cited here was re-opened today. The domain methodology — the Pitch Score implementation guide — is NOT in the tree, was escalated rather than worked around, and is carried as residual R5." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — never fix one thing in a way that silently breaks another; trace ripple effects before acting.",
    "how_this_build_will_embody_it": "Adding elementBreakdown changed the scorer's return type, which every existing consumer and 110 tests depend on. The ripple was traced by running the full suite (4,497) rather than the pitchScore folder alone, and by re-running the five mutations after the test file was refactored." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "An authority's decision must be RETURNED as a verdict and CONSUMED; a consumer must not re-derive it from the raw inputs the authority already judged.",
    "how_this_build_will_embody_it": "This build IS the clause. Four re-derivations were removed by making scorePitch return elementBreakdown and by storing sectionPoints. The drift-guard requirement is met by re-introducing all five bug shapes as mutations and confirming each fails a test." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:30Z",
    "why_it_governs": "Everything is an event, append-only; never update or delete.",
    "how_this_build_will_embody_it": "It is the clause this build does NOT satisfy. store_pitch_score deletes the children on re-score. The reading taken (scoring evidence is not a domain event) is written out above rather than assumed, and the genuine loss — no record that a re-score happened — is carried as residual R1." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Four layers, foundation up; a broken lower layer is not survivable by the layers above it.",
    "how_this_build_will_embody_it": "Layer 2 is where this build lives and where it is honest about stopping: the migration and the writer are verified against real Postgres, and NOTHING CALLS THEM. Layer 3 composition is therefore unproven by construction, stated as residual R2 rather than implied by 4,497 green tests." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first about what could fail, THEN search; the agent audits as it works rather than only when asked.",
    "how_this_build_will_embody_it": "Nobody asked for any of the six findings. G1-G4 came from asking A40's question three (does any consumer re-derive the authority's decision?) against a file that had just been written; G5 and G6 came from reading the scorer's own comments while doing it." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "Knowledge is not intelligence — a fast, fluent, well-formed answer imitates understanding; and the biggest risk is the builder under pressure making it less honest for a faster result.",
    "how_this_build_will_embody_it": "The pressure here was that the work was already reported as nearly done and the writer was supposed to be the easy part. The honest-and-slower path was to stop, add a migration, change the scorer's return type, and re-run everything. Also the standard applied to the tests: two of them failed first time for reasons that were MY fault, including a mock default that would have made a test pass against any implementation, and both are written up in check.md rather than quietly corrected." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "Item 0 — anything offering the founder a decision must be an AskUserQuestion picker with a recommendation, never prose.",
    "how_this_build_will_embody_it": "No decision is posed in prose here. The one founder call this build surfaces — where the score bands sit — is named as residual R3 and explicitly reserved for a picker once real scores exist to place the lines against, rather than asked as a question in a report." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Holding the LABELS without the CONTENT produces work written in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "The first draft of storePitchScore carried a §2.2 citation in its header comment WHILE violating §2.2 four times. That is A19 exactly, at comment scale — the label arrived before the content, and it read as assurance. The clause was then opened and the code rewritten." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1052", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "The verdict pattern, and its four diagnostic questions: is the decision computed in one place, does it return a verdict, does every consumer branch on it, and is the authority running an expensive side effect before a consumer discards the result?",
    "how_this_build_will_embody_it": "Question 4 is G5 at the storage layer: a duplicate element would have failed the unique index at the last step with the LLM call already billed and the score computed. Question 3 drove the audit that found G1-G4 — grep for the authority's condition variables appearing in a second place." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual you wrote is the highest-yield queue, and writing it as a disclaimer is what stops you returning to it.",
    "how_this_build_will_embody_it": "G6 is this pattern inside a source comment: scorePitch collected rejected bonuses and SAID why they mattered, and that sentence was where it ended. The fix was to act on the comment already in the tree." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:30Z",
    "why_it_governs": "'Verified' is a claim about a COMMAND you ran, reported in the words of the project's own gate — not your own scoped recipe.",
    "how_this_build_will_embody_it": "check.md names each command and pastes its counts, separates the real-Postgres verification from the unit tests, and states plainly what was NOT run (npm run build:ci) and what has no caller (residual R2)." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:30Z",
    "why_it_governs": "Citing a constitutional section from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "This session was resumed from a compacted context, so every clause cited here was re-opened from the tree today — §3.1 in particular, which turned out to CONTRADICT the migration and would have been cited approvingly from memory." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:30Z",
    "why_it_governs": "A lesson recorded only in prose will return; a fix is complete when the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The four defects are encoded as reconciliation assertions — stored rows sum to stored totals — rather than as checks of individual numbers, so a future re-derivation fails regardless of which of the six decisions it drops." }
]
```
