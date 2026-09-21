# CLOSURE — the gap I wrote down, then looked into

The previous build's sweep ended with an honest limit, written as a caveat:

> *"decisions the guide states as settled which the product has since changed… would carry no
> flag at all and is not detectable by re-reading the register, because nothing in the register
> marks it."*

Reading that back as an instruction rather than a disclaimer took about five minutes and found a
live defect. Not a hypothetical one — one I had created earlier the same day, already visible on
a page I had assembled myself.

The question that does the work is not "what else might be stale". It is: **for each number this
new system prints, does the product already print that number somewhere?** The first one I
checked was the score band.

`src/lib/coach/gamification/bands.ts` has been the tested single source of truth all along, and
its docblock says so in the clause's own language: *"nothing re-derives these values (§2.2 — a
duplicated band boundary would drift)."*

`storePitchScore.bandFor` re-derived them, under a comment I wrote two days ago claiming the
thresholds were *"an ASSUMPTION, stated as one"* because *"the only evidence available is the
mockups."* The evidence was a file away, in the same `lib/coach` tree.

The near-miss is the part worth keeping. **The boundaries I inferred were right** — 80, 60, 40,
exactly the authority's lines. Getting three numbers right from two data points is the kind of
thing that makes a copy feel earned. What I got wrong was the *set*: no **Elite** at the top, and
the bottom band renamed from **"Needs coaching"** to **"Early"**.

And it was already on one screen. My Progress renders the rep Arena — which consumes the
authority — directly above the Pitch Score boards, which consumed my copy. A 95-point pitch would
have read Elite in the gauge and Strong in the card beneath it. A 20-point one, "Needs coaching"
above "Early". Same rep, same page, same number, two answers, no error on either.

My tests were worth nothing against this, and precisely why is the lesson. `bandFor(80.3) ===
"Strong"` and `bandFor(77.0) === "Solid"` are true under both versions, because those two values
fall where the copies agree. Two green tests on a function that contradicted the rest of the
product at both ends of its range — the fixtures-too-clean-to-discriminate failure, in the one
case where the correct answers were sitting in a file I could have opened. The new guard asserts
agreement at every half-point from 0 to 130; reinstating the old copy now fails three tests,
where before it failed none.

That makes three duplicated decisions found in one session — the manager predicate, the
lowest-section helper, and now the bands. **All three were correct on the day they were written.**
That is the whole difficulty with §2.2, and why it reads like a tidiness rule right up until you
notice that every instance passed review, passed its tests, and came annotated with reasoning.
A duplicate is never wrong when you write it.

Two of the three were found by looking around. This one was found by writing down what the
previous look could not see, and then going there — which is worth more than the fix, because it
is repeatable and the fix is not.

---

## Residual

```json
[
  { "id": "R1-the-technique-has-been-applied-to-exactly-one-number",
    "item": "The question that found this — does the product already print this number? — was asked about the band and nothing else. The Pitch Score system also prints a score out of 100, a points total, a rank, a streak-adjacent 'best pitch', and prize eligibility, and gamification/ has points.ts, competitionRank.ts and milestones.ts.",
    "why_skipped": "Each is a real comparison against a real file, not a grep, and this build was already a detour from wiring the KPIs.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T16:45:00Z",
    "outcome": "OPENED, and it is the highest-value open item on the board. The band collision took five minutes to find once the question was asked, and competitionRank.ts sitting beside a Pitch Score leaderboard is the same shape with more surface area. Every one of these numbers appears on a rep-facing screen, and My Progress already renders both systems together — so a disagreement is not hypothetical, it is one page." },

  { "id": "R2-no-stored-pitch-carries-a-band-yet-and-the-next-such-change-will-not-be-free",
    "item": "pitches.band is written at store time as text. Nothing has been stored, so the four-band wording never reached the database. Had it, those rows would now be wrong and nothing would re-band them.",
    "why_skipped": "Nothing to migrate.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T16:46:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. It genuinely does not matter today. It is recorded because the reason it does not matter is luck — the correction landed before the first write — and the same change next month is a backfill. Storing a derived LABEL rather than deriving it on read is what creates that exposure; the column was chosen so the founder could retune bands without a migration, which is the opposite trade and worth re-examining once real rows exist." },

  { "id": "R3-band-labels-changed-without-the-founder-choosing-them",
    "item": "A rep scoring 95 now reads Elite where they would have read Strong, and 20 reads 'Needs coaching' where it read 'Early'.",
    "why_skipped": "Not skipped — but worth being explicit that this is the agent ALIGNING to an existing founder decision, not making a new one.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T16:47:00Z",
    "outcome": "OPENED as a notification rather than a question. The wording is the founder's, from RUBRIC-SPEC, and the change is toward it — so no decision was taken here, one was un-taken. The reason it is not zero-risk: 'Needs coaching' is a heavier thing to say to a rep than 'Early', and the founder may have wanted the softer word specifically on the pitch card even while keeping the harder one on the arena. If so that is a deliberate divergence and belongs in the band table as such, not as an unmarked copy." },

  { "id": "R4-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried unchanged for the ninth build.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T16:48:00Z",
    "outcome": "OPENED. Two of today's errors came from building against documents rather than against the product: one absent, one stale. The bands were in neither document and in the code all along." }
]
```
