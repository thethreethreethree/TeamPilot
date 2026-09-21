# CLOSURE — the question that had already been answered

I opened the door log to find out how many doors a rep had knocked. What I found was that a
decision I had recorded two days earlier as *open* had been settled three months ago, and that
the default I chose while waiting for it was the one the founder had already thrown out.

The build guide calls it Open decision #1 and says *"confirm with John before building."* John
confirmed. On 2026-09-11, in production, with numbers in front of him.

> A presentation is a door where the rep **spoke to somebody**: `doors_knocked − no_answer`.
> Not a recorded pitch.

And it is a *reversal*, which is what makes it binding rather than a preference. On 2026-08-28
the founder did pick recorded pitches, and the reasoning was good: checked against one rep, 41
recorded against 46 non-no-answer knocks, and at a five-door gap the sharper measure is plainly
the better one. That reasoning was right when it was made.

The gap did not hold. By 2026-09-11 the same rep was 126 spoken-to against 50 recorded, and the
founder's own row read 18 spoken to, 3 recorded, and 10 sold — a close rate of 333%, because
sales are counted from knocks and the denominator was being counted from audio. It reached their
home screen as *"0 of 9 PRESENTATIONS"* beside *"9 of 1 SOLD"*.

Sold exceeding presentations is not a definition preference. It is a broken denominator.

What I got wrong is not the arithmetic, and the guide was not wrong either — it was **old**. It
asked a question that had since been answered, and the answer was in the working tree, in the
file that owns the data, with its evidence attached. §0.1 says the methodology must be present at
the moment of action; the usual reading is *is the document there*. This is the other half:
present and unread produces the same outcome as absent.

The part worth keeping is subtler than the fix. **Flagging something as open is not a neutral
act.** It feels like the careful move — noting rather than assuming, provenance stated, switch
wired for later — and every one of those careful gestures made the wrong default look
considered. A question marked open when it is closed is a wrong answer wearing the costume of a
right one, and it is harder to catch than a plain mistake because it comes pre-annotated with the
reasons it should be trusted.

Had it shipped, the Pitch Score boards and the Door Log's own KPI bubbles would have shown
different presentation counts for the same rep on the same day in the same product — two
definitions of one decision, one per screen — and the Pitch Score side would have been the one
already reversed for producing impossible close rates. Neither screen would have errored. Each
would have looked right alone.

The test that matters is not the one asserting the new default. It is the one that takes the
founder's real row — 20 knocked, 18 spoken to, 3 recorded, 10 sold — computes the KPIs under the
**old** default, and asserts the close rate exceeds 100%. The 333% is in the suite now, not in a
comment. A comment saying "do not use recorded pitches" is exactly the prose A30 says returns.

One detail is worth noticing on the way out: the corrected definition produces the **same** team
row the mockups show — 671 doors, 98 presentations, 20 sold. The old default was not visibly
wrong on the mockup data. It was wrong on the founder's real data. That is why it survived being
written down, reviewed, tested, and recorded in a contradictions register as carefully handled.

---

## Residual

```json
[
  { "id": "R1-the-three-KPI-exports-are-still-uncalled",
    "item": "countPresentations, computeActivityKpis and sumTeamTotals remain reachable-by-file and called by nothing. The Today's Metrics board that would consume them is unbuilt.",
    "why_skipped": "This build stopped to correct the definition rather than building the surface on top of it. A board built on the old default would have shipped the founder their own reverted bug.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T16:20:00Z",
    "outcome": "OPENED as the next build, and the sequencing is the point: the number is correct BEFORE anything renders it, which is the only reason this is a code change and not an incident. Worth noting the file-level reachability gate is green on all three — exactly the blind spot named in the previous build's R4, confirmed one build later." },

  { "id": "R2-how-many-other-guide-decisions-are-already-settled-in-the-record",
    "item": "The build guide carries several 'confirm with John' items. One of them had been answered three months earlier in the codebase. The others have not been checked against the record.",
    "why_skipped": "Checking each means finding where in the product that decision would live and reading it — real work, and this build was already a detour from wiring the KPIs.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T16:21:00Z",
    "outcome": "OPENED, and it is the generalisation of this entire build. B4 (does a Partial count as a miss in pattern detection?) is the immediate one, and the door log's pattern rollup is where its answer would be if it has one. The class: a guide written at a point in time asks questions the product then answered, and every one of those is a place where careful-looking deferral produces a default the founder already rejected. This should be swept, not discovered one at a time." },

  { "id": "R3-the-founder-s-numbers-were-taken-from-a-docblock",
    "item": "126 vs 50, and 18 spoken / 3 recorded / 10 sold, come from the doorlog.ts docblock. They were not re-measured against production.",
    "why_skipped": "Read-only prod access for a measurement that only motivates a decision already made.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T16:22:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. It looks safe because the numbers only justify a decision that is settled either way, and the implementation was verified independently by reading both functions. The reason it is not nothing: those figures are now quoted in a test name, a register entry and this closure, so if the docblock mis-stated them the mis-statement has been amplified four times today by someone who did not check." },

  { "id": "R4-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried unchanged for the eighth build.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T16:23:00Z",
    "outcome": "OPENED — and this build is the strongest argument yet for why it matters. A missing document caused exactly one error today; a PRESENT-but-stale document caused this one. Both are the same failure with different causes, and only one of them announces itself." }
]
```
