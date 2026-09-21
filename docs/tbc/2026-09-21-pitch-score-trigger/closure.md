# CLOSURE — plumbing is where the silent defects live

The previous build closed by saying, plainly, that 4,497 green tests described a system which had
never scored a real pitch. The engine existed. The writer existed. Nothing called either. A36 says
the residual you wrote is the highest-yield queue in the audit and that writing it as a disclaimer
is precisely what stops you going back to it, so this build went back to it before doing anything
else.

The job looked like plumbing: read the session, call the engine, call the writer, return JSON.
That framing is the trap. Plumbing is where the quiet defects live, because a plumbing defect does
not throw — it succeeds, returns 200, and writes a plausible number somewhere slightly wrong.

So the five questions were asked before the session shape was read, and all five turned out to be
real.

**Whose score is it.** `SalesSession.agentId` is the rep; `auth.user.id` is whoever pressed the
button. Managers can read their reps' sessions by design, which is the whole point of the
owner-or-manager RLS — so the natural implementation files every manager-triggered score against
the manager. Their leaderboard inflates, the rep's stays empty, and nothing anywhere errors.

**When was it.** An upload processed three days after the call has a wall-clock nowhere near its
own audio. This product has already shipped that once — a call recorded on the 4th filed as
happening on the 11th — and it is the same reason `generatePitchScore` derives its transcript
offsets from the first timed segment rather than from the session's start. A leaderboard filtered
by week would put the pitch in the wrong week.

**Is every session a pitch.** `session_kind` is sales, meeting, or huddle. A team huddle graded
against a door-to-door rubric does not error; it produces a real-looking low score for a
conversation that was never a pitch, and it drags the rep's average down. Refused with a reason,
and refused **before** the LLM call rather than after — scoring it and then discarding the result
is the empty-but-billed shape with the money already spent.

**Do the vocabularies match.** They do not. `SalesOutcome` has five values and `pitches.outcome`
allows three. Forwarding `no_contact` violates the CHECK and loses the entire write *after* the
grading has been paid for. The tempting repair is to map it to `no_sale` and avoid the null, and
that is worse than the crash: a door nobody answered is not a lost sale, and folding the two makes
the sold-rate count unopened doors as pitches that failed. §3.5 forbids measuring the convenient
thing in place of the real one. Null is the honest value — the outcome is unknown to this table's
vocabulary, and saying so costs nothing.

**How long was it.** `audioDurationSeconds` is the real length from the transcription word
timestamps; started-to-ended for an upload is how long the file took to process. Preferring the
wrong one misreports the length of every uploaded pitch.

Five for five, and not one of them would have failed a test written from the happy path.

The read side had its own single point of failure, and it is the obvious implementation. Showing
section totals by summing the element rows is what any reasonable person writes, and it is wrong
on every objection-free pitch, because those rows are at raw rubric weight while Delivery was
scaled from 27 to 35. It would have re-introduced, on the read, exactly the defect migration 0254
was written that morning to remove. The fixture for that test is built to disagree — stored
Delivery 19.2 against element rows summing to 9.5 — and asserts both halves, because a fixture
where the two happened to match would have passed against the bug.

Thirty route tests passed on the first run, which is when to distrust rather than to ship. Eleven
mutations across the route and the reader; every one failed a test.

One correction worth keeping on the record rather than quietly fixing: the §3.5 manifest entry
first claimed the sold-rate was "one of the two hard metrics" and cited a line range that was not
where §3.5 lives. Reading it showed the hard metrics named there are meeting duration and
completion/resolution rate. The claim and the range were both corrected. A manifest entry asserts
that a clause was read; writing one from memory is the exact failure A22 exists to catch, and it
is no less that failure for being nearly right.

Project 1 is now reachable. It is not finished: nothing renders a score, nothing scores
automatically, and no real recording has been through it. The launch gate the guide sets — ten to
twenty real pitches scored and hand-graded in parallel — is now possible for the first time, and
has not begun.

---

## Residual

```json
[
  { "id": "R1-scoring-is-on-demand-only-and-whether-it-should-be-is-the-founder-s-call",
    "item": "No session is scored automatically. A rep finishes a call, the transcript lands, and nothing produces a Pitch Score until something calls POST.",
    "why_skipped": "Auto-scoring on finalize spends an LLM call per session, across every rep and every call, and it interacts with the guide's open decision #1 (is a 'presentation' a recorded pitch, or a rep-logged one?). That is a cost-and-definition decision, not an implementation detail.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T13:05:00Z",
    "outcome": "OPENED and reserved for a founder picker per §6 item 0, rather than defaulted quietly in either direction. Defaulting to auto spends money nobody approved; defaulting to manual means the leaderboard is populated only for pitches somebody remembered to score, which makes every average a sample of the pitches a manager was curious about. Both defaults are wrong in ways the founder should choose between. The picker needs a cost-per-pitch figure attached, which is a measurement this build did not take." },

  { "id": "R2-nothing-renders-a-pitch-score",
    "item": "The route returns JSON that no screen consumes. A rep cannot reach any of this; curl can.",
    "why_skipped": "The Pitch detail surface is Project 2 in the build guide, and its shape depends on resolution B1 — which rests on an instruction image the API rejected and never displayed, now marked unconfirmed in the contradictions register.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T13:06:00Z",
    "outcome": "OPENED. This is the previous build's R2 moved up one layer rather than closed: it used to be 'the engine has no caller', it is now 'the caller has no surface'. Worth naming because the shape repeats — each build makes the system one step more reachable and the honest statement stays 'a rep still cannot use it'. The blocking dependency is a founder confirmation, not engineering." },

  { "id": "R3-the-route-has-never-been-called-against-a-live-session",
    "item": "Behaviour is proven against mocks; the migrations are proven against real Postgres 16. Neither is end-to-end. The engine's prompt has never been sent to DeepSeek with a real transcript.",
    "why_skipped": "Requires a real session with a transcript in a real environment, and the founder's go-ahead to spend an LLM call against production data.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T13:07:00Z",
    "outcome": "OPENED, and it is the highest-value unknown in the whole of Project 1. Everything measured so far is arithmetic and plumbing; the untested half is whether the model actually grades thirty elements consistently against a real door transcript, which is what the launch gate is FOR. The token budget was measured (~1,440 typical / ~1,785 worst) and the non-reasoning model chosen on that basis, but a measurement of the expected output is not an observation of a real one." },

  { "id": "R4-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried forward unchanged from the previous build's R5. Guide page 2 names it as holding Project 1's full scoring detail; it has never been read.",
    "why_skipped": "Not in the working tree and not obtainable by the agent. Flagged rather than worked around.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T13:08:00Z",
    "outcome": "OPENED and now MORE pressing than yesterday, for a specific reason: this build made a seventh decision the guide may already have made — the scoring TRIGGER — on top of the six the scorer already encodes. Each build widens the surface that would have to be revisited if the document says something different. The §0.1 precondition is unmet and the cost of the gap compounds per commit." },

  { "id": "R5-the-outcome-mapping-is-silent-where-it-could-be-informative",
    "item": "A session with outcome 'no_contact' stores a null outcome and says nothing about why. The distinction between 'we never recorded an outcome' and 'the door was not answered' is lost at the pitch layer.",
    "why_skipped": "pitches.outcome is a three-value CHECK and widening it is a migration plus a decision about what the Recordings list should show for an unanswered door.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T13:09:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. It looks harmless because the session row still holds the true outcome, so nothing is destroyed. It may not be harmless because an unanswered door is also the most likely pitch to fail the qualifying test, and a rep looking at 'Not counted' with a blank outcome gets no explanation from either field alone — the two halves of the answer live in two tables. The cheap version is not a migration: have the Recordings list read the SESSION's outcome rather than the pitch's." }
]
```
