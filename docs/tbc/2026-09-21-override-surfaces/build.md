# BUILD — the manager can correct it, and the rep can see that they did

### The correction control, on the dispute card itself

- write-path: `src/components/sales-coach/DisputeQueue.tsx` — a value select and a **Correct and
  reply** button inside the open dispute's card. No navigation, no second screen: the manager is
  already looking at the claim and the evidence, and a control that made them leave would be used
  by the managers who had time rather than the ones who were right.
- write-path: **the manager's note IS the reason.** One box, two outcomes. A separate "reason"
  field next to a reply box is how a required field becomes "asdf" — and this particular required
  field is the one sentence the rep reads next to their changed score.
- write-path: the order is correct-then-reply, and the order is the design. If a reply were filed
  first and the correction then failed, the record would hold a reply saying the score was fixed
  when it was not — worse than silence.
- write-path: `itemKindOf()` asks the **rubric maps** which vocabulary an id belongs to. The ids
  are prefixed (`close.paperwork`, `bonus.directv`, `viol.talkingOver`) and splitting on the dot
  would work today; it would also be a second, silent definition of what makes something a bonus,
  agreeing with the rubric on the day it was written (§2.2).
- write-path: the control is absent — deliberately — on a whole-score dispute and on an item the
  current rubric no longer knows. There is nothing safe to correct in either case and the server
  would refuse it, so offering it would be a button that fails. The reply box remains, so the card
  never becomes a dead end.
- read-path: a manager reading a dispute they agree with picks the new value, and the note they
  already typed becomes both the reply and the logged reason.
- read-path: the copy above the button states what is about to happen — *"Your note becomes the
  reason, and {rep} will see it on their pitch. Logged and permanent."* — before the click, not as
  a 400 afterwards.

### The state worth naming: corrected, but the reply did not send

- write-path: a third state alongside success and failure. Once the override returns 200 the score
  **has moved** and nothing later can un-move it, so no subsequent failure may be reported as
  though the correction did not happen.
- write-path: the message says so plainly — *"The score was corrected and {rep} will see it. The
  reply didn't send — don't correct it again; just reply."*
- read-path: a manager who saw the generic "nothing was recorded" here would correct it a second
  time, and the second one is a second logged override on a score that was already right. The
  append-only log makes that permanent, which is exactly why this state cannot be collapsed into
  the failure case.

### The rep sees the correction, above the fold

- write-path: `src/components/sales-coach/PitchDetail.tsx` — a corrections section rendered
  **directly under the score card**, before the section breakdown. A rep who remembers a 44 and
  opens a 47 gets the explanation before the detail, because a number that changed with no visible
  reason is indistinguishable from a number that was wrong all along.
- write-path: direction is given **in words** — "Removed → Awarded", with an `sr-only` "changed to"
  behind the arrow — never by colour alone. A red/green distinction is invisible to roughly one man
  in twelve and this row exists to be understood.
- write-path: an item the scorer never graded reads **"Not scored → Hit"** rather than a blank,
  which would read as something taken away.
- write-path: grade labels are derived from `GRADE_STYLE` rather than retyped, so the badge above
  and the correction row below cannot end up calling one thing two names.
- write-path: not gated on `pitch.disputes`. A manager can correct a pitch nobody disputed, and
  that is exactly the correction a rep would otherwise never learn about.
- read-path: the reason renders in full under a "Why" label, and the section closes with *"Your
  score above already includes these"* — without which a rep cannot tell whether the headline
  number is before or after.

### Surviving a server that has never heard of overrides

- write-path: `(pitch.overrides ?? [])` at all three access points in `PitchDetail`.
- write-path: this is not defensive noise. `PitchScorePanel` obtains the pitch through
  `await res.json() as StoredPitch` — a **cast**, which is a claim about a network payload rather
  than a guarantee about one. For the length of any rollout a browser running this code can be
  served by a server that predates the field.
- read-path: without the guard, `undefined.length` throws inside render and blanks the **entire**
  pitch panel — the score, the sections, everything — because a section with nothing to show could
  not show nothing. Six tests failed exactly that way before the guard existed.

### The superseded constraint, kept rather than deleted

- write-path: `DisputeQueue.tsx`'s docblock now carries the old prohibition as a **SUPERSEDED
  CONSTRAINT**, with the reason it was superseded and the four mechanisms that answer the fear it
  was protecting against.
- write-path: `docs/SYSTEM UPDATES AND REVISION/LOGIC-AND-CONTRADICTIONS.md` section K records it
  in full, including why the original reasoning was sound and its conclusion still wrong.
- write-path: one sentence was removed rather than kept — *"Re-score the pitch if the grade was
  wrong."* It was right when the card could not correct anything and now points a manager away from
  the control directly above it. The test asserting it was updated with the reason written next to
  the assertion.
- read-path: the next reader of that file finds the argument and its resolution, not an unexplained
  reversal.
