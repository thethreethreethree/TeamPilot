# CLOSURE — the loop closes, and one of its ends has still never been looked at

## What shipped

A manager reading a dispute they agree with can now correct the item from the card they are already
on, using the note they have already typed as the logged reason. The rep opens their pitch and sees
what changed, why, and that the score above already includes it.

R2 and R4 of `2026-09-21-pitch-score-override/closure.md` are closed by name. That build's record
was **not** edited to pretend they never existed (§3.1) — it said "no UI" and that was true when it
was written.

## What this build got right, and it was not the code

The prohibition in `DisputeQueue.tsx` was mine, written that morning, and it was wrong. What made
it catchable was not vigilance — it was the founder deciding explicitly and the rubric PDF being in
the working tree to check against (§0.1). Had neither existed, a constraint I invented would have
defined the product, and it would have read as reasoned the whole way.

The new thing on the record is the distinguishing question: **does this rule name a source, or make
an argument?** Both look the same in a docblock. Only one is a constraint.

## The un-named reliance

- **That the two writes cannot be made atomic.** Correct-then-reply is two requests, and the middle
  state is real. It is handled honestly rather than eliminated. A single endpoint that did both
  would remove the state entirely, and that was not built because the dispute-answer route already
  exists and coupling it to overrides would make one route own two decisions.
- **That the rep will open the pitch.** The correction renders where a rep who looks will find it.
  Nothing notifies them. A manager who corrects a score believes the rep has been told; the rep has
  only been told if they open the pitch.
- **That `itemKindOf` returning null is always the right refusal.** It is right for a whole-score
  dispute and for a retired item. It is also what happens if the rubric module ever fails to load
  its maps — in which case every correction control silently disappears and nothing says why.
- **That jsdom render equals browser render.** Every claim in check.md about what a manager sees is
  a claim about a virtual DOM. The select, the button and the amber partial-failure line have never
  been drawn.

## Residual

```json
[
  { "id": "R1-nothing-has-been-rendered-in-a-browser",
    "item": "Both surfaces are covered by jsdom render tests and neither has been looked at. The value select, the Correct-and-reply button, the amber corrected-but-unreplied line and the rep's correction row have never been drawn at any width.",
    "why_skipped": "No browser in the loop; the agent cannot look at a running page.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T21:40:00Z",
    "outcome": "OPENED because it ranks highest, and A36 says that is where to read hardest. The confidence comes from the tests being thorough, and that is precisely the wrong reason: every one of them asserts TEXT and CLASS NAMES, and not one asserts anything a person would call appearance. Concretely — the correction row sits inside a `bg-base/40` panel nested in a `bg-surface` card, a nesting no other row on that screen uses, and nothing here has checked those two surfaces are distinguishable in both themes. `npm run theme:audit` passes, but it catches theme-bound LEAKS, not two tokens that happen to render nearly identically. The founder's standing law is that a graphic must be looked at before it is claimed to work; the same reasoning covers a surface, and this one has not been." },

  { "id": "R2-the-rep-is-never-told-their-score-changed",
    "item": "A correction renders on the pitch detail. Nothing pushes it. A rep who does not reopen that pitch never learns their score moved.",
    "why_skipped": "Notification is a product decision with a delivery mechanism behind it (in-app, email, extension badge), and this build had no mandate to choose one.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T21:41:00Z",
    "outcome": "OPENED. This is the largest remaining hole in the loop and it undercuts the build's own premise: the reason overrides exist is that 'you're right' followed by an unchanged number teaches a rep that disputing is theatre. A changed number nobody mentions is a quieter version of the same lesson. Mitigated for DISPUTED items — the manager's reply lands in the rep's dispute thread, which they filed and will look at — and unmitigated for the proactive case, a manager listening back and correcting a pitch nobody complained about, which is exactly the correction this build argued a rep would otherwise never learn about." },

  { "id": "R3-no-end-to-end-path-has-run",
    "item": "The manager's click is tested against a mocked fetch. No run has gone from a real dispute through the real route to a real pitch_score_overrides row and back onto a rep's screen.",
    "why_skipped": "No seeded environment with a scored pitch, a rep, a manager and a dispute.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T21:42:00Z",
    "outcome": "OPENED. The seam most likely to be wrong is the one no unit test spans: the route returns the recomputed verdict, the queue reloads from a different endpoint, and the rep's pitch is read by a third. Three reads of the same corrected score, and nothing has ever compared them. Every individual read is tested; their agreement is assumed." },

  { "id": "R4-pitch-disputes-has-the-same-unguarded-cast",
    "item": "`pitch.disputes` is accessed without `?? []`, through the identical `as StoredPitch` cast that made overrides crash the panel.",
    "why_skipped": "Its server shipped before this client did, so the rollout window has already closed for it.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T21:43:00Z",
    "outcome": "OPENED. The argument for leaving it is sound and the result is still bad: one file now guards one field and not its neighbour, for a reason visible nowhere in the file. A reader concludes the guard is stylistic and copies whichever they saw last. Either both are guarded or the asymmetry is commented; neither was done here." },

  { "id": "R5-the-superseded-constraint-class-has-no-gate",
    "item": "A rule invented by the builder reads identically to one that cites a source. F4 was caught by the founder deciding explicitly, not by anything structural.",
    "why_skipped": "A grep for MUST NOT / CANNOT / never flags every correct constraint in the codebase — A30's noisy-gate failure, which trains people to skip the gate.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T21:44:00Z",
    "outcome": "OPENED. Worth stating plainly: this is the FIFTH distinct instance today of a decision made away from its authority, and the first where the authority did not exist at all. The other four drifted from something; this one was invented. The record now holds the distinguishing question, which is prose, and A30's whole point is that prose returns." },

  { "id": "R6-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried unchanged for the ninth build. Resolutions B1 and B2 in LOGIC-AND-CONTRADICTIONS.md rest on a description that was inferred, not observed.",
    "why_skipped": "The image was rejected by the API and cannot be opened; LAW 1 forbids describing it from anything else.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T21:45:00Z",
    "outcome": "OPENED, unchanged. It does not touch this build — both surfaces are specified by the rubric PDF, which IS in the tree and was read — but it is the oldest unpaid debt in this workstream and it is now nine builds old." },

  { "id": "R7-the-milestone-and-rank-surfaces-still-collide",
    "item": "'First pitch' / 'Century' on the milestone strip, and the rank surface, still carry gamification meanings alongside Pitch Score's. The PDF (p.6) says Pitch Score IS the competition leaderboard.",
    "why_skipped": "Each collision is a founder call about what a rep sees.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T21:46:00Z",
    "outcome": "OPENED. More pointed after this build, not less: a manager can now change a Pitch Score, and the rank surface still orders reps by the other system. A correction that moves a rep on one leaderboard and not the other is a visible contradiction the moment somebody checks." }
]
```
