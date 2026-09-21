# CLOSURE — the score said 62.4 and the rows under it added to 48

The last piece of Project 1 was supposed to be twenty lines. Take the graded elements, look each
one up in the rubric, multiply by the grade credit, write the rows. It typechecked on the first
try.

It was wrong four separate ways, and the four share a single shape: the writer re-deciding
something `scorePitch` had already decided. That is §2.2 and A40 — the clause this codebase
earned on 2026-08-14, when a `call()` wrapper re-derived a suppression decision the authority had
already made, dropped one term while doing it, and served every guidance-off account an empty AI
read for weeks with the LLM call succeeding and being billed each time.

The reason it was tempting here is worth writing down, because the next person will feel the same
pull. The model returns *grades*. Someone has to turn grades into points, and the writer is
holding both the grades and the rubric, so it looks like the natural place. The rule reads as
duplication pedantry right up until you count what the scorer decides that the rubric alone does
not: the audio-confidence floor, the per-bonus repeatable ceiling, the +30 pool cap, the
objection exclusion, the Delivery scale factor, and duplicate resolution. Six decisions, none of
them visible in a list of element ids and grades.

Drop any one and the rep's Pitch detail stops adding up to the number printed above it.

The quietest of the four is the scaling. When a customer raises no objection, the rubric does not
score Objection handling at all — it scores the other five Delivery skills out of 27 and scales
them to 35, so a smooth pitch is not punished and dodging objections earns nothing free. Which
means the raw element rows come to roughly 77% of the Delivery figure that actually went into
`base`. Any screen that sums element rows shows a number that disagrees with the score beside it,
on every objection-free pitch, forever, with types sound and tests green. It would have been
found by a rep with a calculator, not by CI.

The one that would have hurt a person is Objection handling itself. Stored as `missed` on a pitch
where the customer never objected, it is a false accusation sitting on the record — the exact
thing the rubric's scaling rule exists to prevent — and it is the kind a rep disputes and cannot
win, because the number *is* what the system says happened.

Two more turned up on the way, and neither is re-derivation.

A duplicate element was double-counting into `base`. The model is asked for thirty graded
elements in one answer; listing one twice is a formatting slip, not a scoring event. It is also
unstorable, since `pitch_elements` is unique on `(pitch_id, element_id)` — so the write would have
failed at the very last step with the LLM call already paid for and the score already computed.
A40's fourth question, at the storage layer instead of the gate layer.

And a promise the storage layer was not keeping. `scorePitch` already collected the bonuses it
rejected for low confidence, and the comment above that line says exactly why it bothers: *"a
rejected one is recorded rather than dropped silently, so the dispute has something to point
at."* Nothing stored them. A rep asking why they missed the inside-the-home bonus would have got
the precise answer the rubric calls insufficient — *"the AI didn't see it"* — instead of *"it
heard it at 0.62, below the 0.80 floor."* That is A36 inside a source comment: the honest note
was written, and writing it was where it ended. It is now a third event kind, `rejected_bonus`,
worth zero, carrying its confidence to the dispute.

The fix is not "be careful in the writer." The writer cannot be careful enough, because what it
needs is not in its inputs. `scorePitch` now returns `elementBreakdown` — what counted and for
how much — and `pitches.section_points` stores the section verdict instead of inviting everyone
to re-sum it. Element rows stay at raw rubric weight so each one reads true on screen
(`Tonality 1.5/3, partial`) while the section verdict carries the scaled figure that reconciles
to `base`. The alternative kept the sum and made every individual row lie.

One contradiction is recorded rather than resolved. §3.1 says events are append-only — *"Never
update or delete."* `store_pitch_score` deletes the element and event rows when re-scoring a
session. The reading taken is that these are scoring evidence attached to a derived artifact, not
domain events in the chain §3.1 governs, and that appending a second full grading would break the
sums on the next read with no way to tell which grading is current. What is genuinely lost is the
ability to see that a re-score happened at all. That is R1 below, and its right shape is an
append-only revision row, not a refusal to delete children.

The five bug shapes were each re-introduced as a mutation and each one failed a test. Two tests
failed on the first run and both were the test's fault — one guessed element id, and one mock
helper whose default would have made the null-id test pass against any implementation at all.
That second one is the more interesting failure, and it is the same disease as the code it was
written to check.

Verified against real Postgres 16, in the words of what was run: one `store_pitch_score` overload
after the signature change, `authenticated` and `anon` both false for execute, re-apply
idempotent, `section_points` summing to `base` on a round trip, `rejected_bonus` at 0.62
confidence and zero points, an invented event type refused, an evidence-free score still refused.
4,497 tests, `rls:audit` 0 gaps, `invariant:audit` 0 violations.

Nothing calls any of it yet. That is the next build and it is named below, not implied.

---

## Residual

```json
[
  { "id": "R1-a-re-score-leaves-no-trace-that-it-happened",
    "item": "store_pitch_score deletes pitch_elements and pitch_events on re-score, against §3.1's append-only rule. After a re-score there is no way to see that the pitch was ever scored differently, or what changed.",
    "why_skipped": "Appending a second full grading breaks the 'sections sum to base' identity on the very next read and leaves no way to tell which grading is current. The correct shape is a separate append-only pitch_score_revisions row capturing the prior totals, which is its own build with its own RLS.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T12:20:00Z",
    "outcome": "OPENED. It matters most exactly when a rep disputes a score and a manager re-runs it: the thing they want to compare against is the one thing that was just deleted. The auto-heal path makes re-scoring routine rather than rare, so this will be exercised in production. Named as a contradiction in think.md and in the contradictions register rather than resolved quietly, per the founder's standing instruction that contradictions are noted, not applied." },

  { "id": "R2-nothing-calls-the-engine-or-the-writer",
    "item": "generatePitchScore and storePitchScore both exist, are tested, and have no caller. No route, no job, no trigger. Project 1 is not operable.",
    "why_skipped": "The trigger is a separate decision — whether scoring runs on transcript completion, on demand from the manager, or on a backfill — and the guide's Open decision #1 (presentations source: recorded pitches vs the rep log) bears on it. Building the route before that is settled risks wiring it to the wrong event.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T12:21:00Z",
    "outcome": "OPENED and stated in check.md rather than folded into the passing counts. 4,497 green tests describe a system that has never scored a real pitch. The launch gate the guide sets — 10 to 20 real recordings graded in parallel by a manager — cannot begin until this exists, so it is the critical path for Project 1, not a follow-up." },

  { "id": "R3-bandFor-thresholds-are-inferred-from-two-data-points",
    "item": "Strong/Solid/Developing/Early boundaries at 80/60/40. The only evidence is the mockups showing 'Strong' beside 80.3 and 'Solid' beside 77.0 — which pins one boundary somewhere between those two numbers and says nothing about the other two.",
    "why_skipped": "Nothing computes with the band; it is a label. Guessing and labelling the guess is cheaper than blocking, and the band is trivially re-tunable because it is stored as text rather than derived on read.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T12:22:00Z",
    "outcome": "OPENED. The reason it is not 'high' confidence: a band is the first thing a rep reads and the last thing anyone thinks to check, and a rep who scores 59.8 and sees 'Developing' where they expected 'Solid' experiences the boundary as a judgement about them. This is the founder's call to make, not an inference from two mockup values, and it should go to them as a picker once real scores exist to place the lines against." },

  { "id": "R4-the-per-element-points-column-is-now-two-things-in-one",
    "item": "pitch_elements.points is raw rubric weight, but pitches.section_points is post-scaling. Both are 'points' and a reader joining them will get a wrong answer unless they notice delivery_scaled.",
    "why_skipped": "The alternative — pre-scaled element rows — makes every individual row misreport its own element's worth, which is worse on the surface a rep actually reads.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T12:23:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. The reason it looks harmless is that it is documented in the column comment and in both source files. The reason it may not be: the next person to build the Breakdown screen will sum element rows because that is the obvious thing to do, and on objection-free pitches it will be quietly wrong — the exact defect this build exists to fix, recurring one layer up. The gate-shaped fix is an assertion in the read path (sum of sections equals base) rather than a comment, and it belongs with the screen that first reads these rows." },

  { "id": "R5-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Guide page 2 names 'Pitch Score System — Engineering Implementation Guide' as holding Project 1's full scoring detail. It has never been read. Everything built so far comes from the five-bullet short version plus arithmetic reconciled against the mockups.",
    "why_skipped": "Not in the working tree and not obtainable by the agent. Flagged to the founder rather than worked around.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T12:24:00Z",
    "outcome": "OPENED and carried forward from the contradictions register section E, unchanged. This build makes it MORE pressing rather than less: six scoring decisions have now been made and encoded (confidence floor, ceilings, cap, objection exclusion, scale factor, duplicate resolution), and each is a place where a written decision may already exist and be contradicted. The §0.1 precondition is unmet and every commit on Project 1 widens the surface that would have to be revisited." }
]
```
