# CLOSURE — displacing a dead end is not closing it

Three times in one day the same thing happened, and the third time it was written down in advance.

The rubric sheet shipped telling reps *"Think a score is wrong? Tap Dispute on the pitch"* when
there was no Dispute. The dispute shipped telling reps *"this goes to your manager"* when no
manager could read it. Each time the promise arrived one step ahead of the system, and each time
it looked finished from the inside.

The second one was caught in its own closure: *"this is the same defect this build was written to
fix, displaced by one step rather than removed."* Writing that is the only reason it got fixed
today rather than after somebody reported it — A36's exact claim, that the residual is the queue
worth reading and that writing it as a disclaimer is what stops you going back to it.

So the loop closes here. A rep files a dispute against a specific element with the timestamp
attached; the manager sees it at the top of Coach Assessment with the rubric label and the moment;
the reply appears back on the rep's Pitch detail. Two people, one piece of evidence, in order.

Four things had to be got right and each fails quietly if it is not.

**Who may answer.** Manager-only on both verbs, not just the read. An answer is the thing that
closes a complaint, so a rep who could write one could close their own and the queue would mean
nothing.

**What an answer may do.** Nothing, to the score. A reply that adjusted points would make the
leaderboard track who complains and who handles complaints rather than who sells — §3.5's
measuring-agreement-instead-of-consequence, with extra steps. The UI says so in words, because a
manager who assumes otherwise replies and believes the rep's number moved.

**What "open" means.** Replayed, never stored. The case a `resolved` boolean gets wrong forever is
the rep who reads an answer, disagrees, and files again: a flag says handled, and the second
complaint — the one they made *because* the first reply did not land — disappears. Replaying says
open, because the newest dispute has no answer after it.

**What an empty queue means.** A failed read is not "no disputes". A manager acts on "none" by
closing the tab, which is the worst available response to a queue that is full and merely
unreadable. It is the same shape as the empty-AI outages this codebase has already paid for twice,
and the component says so on screen: *do not assume it is empty*.

On the way in, the manager predicate turned out to have two homes. `isSalesCoachManager` is the
authority, extracted and tested so that *"a future weakening fails CI, not just review"* — and the
calibration route carried its own copy, with a comment claiming it was *"the same predicate the
coaching RLS uses"*. The comment was the label; the code was a duplicate. It agrees with the
authority today and would stop agreeing the moment the authority gained a term, silently, with
everything green. That is §2.2 and A40 in one file, and the comment is what made it look handled.

Why the copy existed is the useful part: `AuthContext` does not carry `sales_coach_role`, so any
route wanting the predicate must fetch the column, and having fetched it the temptation is to
decide on the spot. The chokepoint answers that (A33) — one helper that does the fetch and hands
the decision to the authority. A fifteen-combination property test pins the two together, so a
second copy of the rule fails rather than drifts.

Replacing it broke three of the calibration route's tests, and the tempting reading was that the
change was a regression. It was not. Both auth paths derive `isAdmin` from `role`, so a context
with `isAdmin: true` and no role is a state production cannot produce — the fixtures encoded an
impossible world, and they failed on a change that is behaviour-preserving. Established by reading
both paths rather than by reverting.

Two defects came from the audit rather than from me, and neither was visible in the code.
`.limit(2000)` is a false bound — PostgREST caps at a thousand — and the consequence is not hidden
old rows but an **answered** dispute reappearing as open, so a manager re-answers work already
done. And INVARIANT 18 flagged the route as anon-writable because `requireSalesCoachManager` was a
name it had never seen; the gate is real, and an audit that distrusts a name it cannot verify is
behaving correctly. Both fixed rather than allowlisted.

A mutation survived, too, and it survived for an instructive reason. The test asserting that
`rep_id` comes from the pitch rather than the request passed against a route reading `body.repId`
— because zod strips unknown keys before the handler sees them. The protection is real and it
lives in the schema, so the behavioural test was verifying it by accident. `AnswerSchema` is now
exported and its shape asserted, and adding `repId` to it fails a test.

Two smaller notes worth keeping. The reader's test mock ignored the query filters and handed every
call the whole fixture — fine with one query, double-counting the instant there were two; a mock
that answers every query identically cannot tell a correct two-query read from a broken one. And
typecheck failed on green tests for the third time today, which is what vitest transpiling without
typechecking buys you.

---

## Residual

```json
[
  { "id": "R1-a-manager-can-reply-but-cannot-override",
    "item": "The only response to a dispute is words. A manager who listens back and agrees the AI was wrong can re-score the whole pitch, but cannot correct one element.",
    "why_skipped": "An override is a founder decision, not an implementation detail: it needs a rule for what happens to a leaderboard that has already been published, and a record of who changed what from what.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T14:30:00Z",
    "outcome": "OPENED and deliberately NOT decided, per §6 item 0 — it goes to the founder as a picker. It matters because the most common real dispute will be one the manager AGREES with, and the current answer to that is 'you are right' followed by nothing changing, which is a worse experience than no dispute at all. The shape that preserves everything built here is a score_overrides event plus a recomputed total, so the original AI score and the override both stay on the record." },

  { "id": "R2-the-rep-never-sees-the-answer",
    "item": "The manager's reply is stored and rendered in the manager's queue. Nothing on the rep's Pitch detail shows it, and nothing notifies them.",
    "why_skipped": "Reading answers on the rep side means readPitchScore also loading dispute events, and notification is its own surface.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T14:31:00Z",
    "outcome": "OPENED — and this is the FOURTH iteration of the exact pattern this build exists to end, which is why it is written plainly rather than buried. The rubric promised a Dispute that did not exist; the dispute promised a manager who could not read it; the queue now lets a manager reply to a rep who cannot see the reply. The loop is one step from closed and is not closed. The next build is the rep-side answer, not a new feature." },

  { "id": "R3-nothing-tells-a-manager-a-dispute-arrived",
    "item": "The queue is a pull surface. A manager who does not open Coach Assessment never learns a rep is waiting.",
    "why_skipped": "Notification infrastructure exists (NotificationBell) but wiring a new kind into it is a separate change with its own delivery and read-state questions.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T14:32:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. It looks fine because the queue is on a page managers visit and carries an open count. It may not be: the whole value of a dispute is that it is time-sensitive — a rep contests a score while they still remember the call — and a pull-only queue means the response time is set by how often a manager happens to look. A feature whose usefulness decays with delay and has no push is one that will be judged as not working." },

  { "id": "R4-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried forward unchanged for the fourth build. Guide page 2 names it as holding Project 1's full scoring detail; it has never been read.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T14:33:00Z",
    "outcome": "OPENED and still compounding. The dispute's shape — append-only, no re-score, manager reviews — is now an eighth decision the absent document may already have made. Every build adds one." },

  { "id": "R5-no-real-dispute-has-ever-been-filed",
    "item": "The queue replays events that do not exist yet, because no real pitch has been scored. The loop is closed in code and has never been walked by two people.",
    "why_skipped": "Depends on R3 of the trigger build — a real recording scored against live DeepSeek — which needs the founder's go-ahead.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T14:34:00Z",
    "outcome": "OPENED. Everything in this build is proven against fixtures and mutations, which establishes that the logic is right and says nothing about whether the workflow is. The first real dispute will be the first time anyone learns whether a rep can describe what the scorer got wrong in a text box, and whether a manager can answer it without listening to the whole recording again." }
]
```
