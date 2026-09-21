# CLOSURE — the other seven numbers

The band collision was found by asking one question about one number: *does the product already
print this?* Its residual said the obvious thing — that the question had been asked once and
there were seven more numbers.

Asking it seven more times took about forty minutes and found five things.

**One is live and shipped this morning.** The rubric sheet tells reps *"Leaderboard = total
points from counted pitches."* `/scoreboard` exists and ranks by the gamification ledger's
`total_points` — the mean of the v5 dimension scores × 10, on a 0-100 scale. A Pitch Score total
is base + bonus − violations, 0-130. The sheet asserted as current fact something the product
does not do, and a rep reading it and then opening Scoreboard would see a number from somewhere
else with no explanation. Same shape as the bands, in copy rather than code.

The rule is the founder's, quoted from the rubric PDF, so it is scoped rather than rewritten:
*"Pitch Score leaderboard = …"*, with a parenthesis saying the Scoreboard tab is a different
board. Their words survive; the product's fact is added. Which board the nav should show is
theirs to decide and is row 2 of the map.

**Two were caught before building, which is the point.** `spark` is *"First pitch scored"* and
the new design has *"First pitch"*. `century` is *"100 sessions"* and the design has *"Century —
100 scored pitches"*. Build the milestone strip fresh and a rep earns two First-pitch badges and
two Centuries under different names. That is the band collision's exact shape, found one step
earlier in the sequence — the difference between a fix and a prevention.

**Two more are authorities waiting to be consumed.** `competitionRanks` for rank; the Arena's
`best`, which is 0-100 where a Pitch Score best is 0-130, so the two are not comparable and must
never appear as one figure.

And I got a row wrong while writing the table. The first draft described `competitionRanks` as
**dense** ranking. It is **standard** competition ranking — `rank = i + 1` on a non-tie, so
1-2-2-**4**, not 1-2-2-3. That is exactly the failure the table exists to prevent, committed
inside the table: a plausible, specific, technically-worded description of an authority, produced
by knowing what ranking functions usually do instead of reading this one. It is kept on the
record because it is the best available evidence that the other seven rows were actually opened.

It also improved the row. The obvious hand-rolled ranker *is* dense — so a second implementation
would disagree the first time two reps tie, which is a sharper warning than "use the authority".

The uncomfortable part is what this build is not. A31 and A30 both push toward gates, and this is
a document; the build guide was a document too, and being three months stale cost an afternoon
earlier today. This table will go stale the same way. A33 is why it is a document anyway: nobody
can write a precise detector for *"these two numbers mean the same thing to a human"*, and an
imprecise one would flag every integer in the tree. Declining to gate is the instruction there,
not a compromise — but it means the map's value decays, and saying so now is better than
discovering it later.

What can be made cheap is the question. Eight rows turn "does this collide?" from an afternoon
into a minute.

---

## Residual

```json
[
  { "id": "R1-the-map-is-a-document-and-documents-go-stale",
    "item": "TWO-SCORING-SYSTEMS.md is a checklist nothing enforces. Nothing fails if a ninth number appears, or if a row stops being true.",
    "why_skipped": "A33 — no precise detector exists for semantic equivalence between two numbers, and an imprecise gate would flag every integer in the codebase and be learned-around within a week.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T17:10:00Z",
    "outcome": "OPENED with the cost named rather than implied. The build guide going stale caused one of today's errors; this document is the same kind of object and will age the same way. The one thing that IS gateable, and now is, was the collision already found — the band cross-check test. A partial gate: each collision resolved becomes a test, so the map shrinks toward things that are enforced rather than remembered." },

  { "id": "R2-the-milestone-overlap-is-diagnosed-and-unresolved",
    "item": "Two of the six designed milestones duplicate two of the five existing ones. Neither strip is built, so nothing is wrong yet — and building either without deciding makes it wrong.",
    "why_skipped": "Merge, rename, or deliberately keep both is a founder decision about what a rep collects.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T17:11:00Z",
    "outcome": "OPENED and reserved for a picker per §6. The reason it cannot be defaulted: 'First pitch' and 'First pitch scored' may genuinely be different events under the two systems — one is the first PITCH SCORED against the rubric, the other the first SESSION scored by the v5 coach, and a rep could reach them months apart. Two badges might be correct. Nobody has checked, and checking is the decision." },

  { "id": "R3-two-leaderboards-in-one-nav",
    "item": "The copy is now honest, and the underlying situation is unchanged: if a Pitch Score board is built, the nav has two things called a leaderboard, ranking the same reps by different totals.",
    "why_skipped": "Founder decision about a live surface.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T17:12:00Z",
    "outcome": "OPENED. Worth stating that the honest copy makes this WORSE to leave, not better: the sheet now tells a rep the two boards are separate, which invites the question of why, and the product has no answer on screen. A parenthesis is a holding position, not a resolution." },

  { "id": "R4-only-numbers-were-swept-not-words",
    "item": "The map covers figures both systems compute. It does not cover language — 'session' vs 'pitch', 'conversation' vs 'presentation', 'score' meaning two different things depending on the screen.",
    "why_skipped": "Vocabulary drift is harder to enumerate than numbers and has no obvious authority to point at.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T17:13:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. It looks soft next to a 333% close rate. The reason it may not be: the presentations bug earlier today WAS a vocabulary collision — two definitions of one word, each correct in its own file — and it took a founder seeing '9 of 1 SOLD' on their home screen to surface it. 'Session' and 'pitch' are currently used interchangeably in places where they are not the same thing." },

  { "id": "R5-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried unchanged for the tenth build.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T17:14:00Z",
    "outcome": "OPENED. Today produced three errors from building against documents rather than the product: one absent, one stale, one where the answer was in neither document and in the code all along. That last category is the one this map addresses." }
]
```
