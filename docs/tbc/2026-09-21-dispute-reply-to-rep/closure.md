# CLOSURE — the fourth time, and the last link

Four builds in one day, one pattern.

The rubric sheet told reps to tap a Dispute that did not exist. The dispute told them it went to a
manager who could not read it. The manager's queue let that manager reply to a rep who could not
see the reply. Each time the promise arrived one step ahead of the system; each time the build
that caused it looked finished from the inside; and each time it was caught only because the
previous closure named its own successor.

That last part is the whole reason this is a chain of four builds in a day rather than a chain of
four bug reports over a month. A36 says the residual is the highest-yield queue in the audit and
that writing it as a disclaimer is precisely what stops you returning to it. Written as a
prediction instead — *"the promise has moved one step ahead again, and here is where"* — it got
read back four times running.

This one closes it rather than moving it. A rep files a dispute against a specific element with
the timestamp attached, sees it marked as waiting, and sees the manager's answer beside the grade
it is about. There is nowhere further for the promise to run.

The thing this build had to avoid was re-implementing "is this thread still open". The manager's
queue already decides it, and the rule is subtler than it looks: an answer closes a dispute only
if it was filed *after* that dispute, so a rep who reads a reply, disagrees, and files again
re-opens the thread. It took a test to get right the first time, and it is exactly the sort of
rule a second reader re-derives slightly differently.

If the two sides disagreed the failure would be silent and would read, to the people involved,
like being gaslit: the manager's queue says handled, the rep's screen says waiting, and neither
of them gets an error. That is §2.2 with a person on each end of it. So the replay was extracted
first — pure, exported, one home — and the rep-side reader written second. The manager's
seventeen tests then passed **unchanged**, which is the evidence the extraction came out
behaviour-identical rather than the claim that it did.

The agreement between the two sides is itself a test rather than a comment. The rep-side suite
asserts a re-filed dispute reads as open — the same case the manager's suite asserts — because
that is the term a local copy would drop and the one whose loss nobody would see.

The state that would have been skipped is waiting. The easy version shows the reply when there is
one and shows nothing when there is not, which reads as *nothing happened* — and that is what a
rep concludes when a complaint disappears. It matters past politeness: disputes are the only
correction signal the scorer has, and a rep who stops filing them takes the calibration data with
them. So an unanswered dispute says it is waiting, and says the score does not move in the
meantime, because a rep who believes their number is provisional will not trust the leaderboard
while they wait.

One mutation is worth keeping on the record. Dropping `includeAnswered` on the rep side makes a
dispute vanish from their screen the moment a manager replies — the answer arriving and the
thread disappearing in the same instant. It would have looked exactly like the bug this build was
written to fix, and it is one word.

Nothing was added to the schema. No table, no endpoint, no event kind. The rep's view is the same
event log the manager reads, replayed with a different scope through their own client.

---

## Residual

```json
[
  { "id": "R1-both-sides-are-pull-surfaces",
    "item": "Nothing notifies anyone. A manager learns a dispute exists by opening Coach Assessment; a rep learns of a reply by re-opening the pitch. Neither is told.",
    "why_skipped": "NotificationBell exists but wiring a new kind into it brings its own delivery and read-state questions, and it is a change to a shared surface rather than to this feature.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T15:00:00Z",
    "outcome": "OPENED, and carried forward from the queue build where it was also R3 — which is itself the signal. The loop is now complete and still SLOW: the whole value of a dispute is that it is time-sensitive, filed while the rep still remembers the call, and a pull-only cycle sets the response time by how often two people happen to look at two different pages. A feature whose usefulness decays with delay and has no push will be judged as not working, and the judgement will be about the feature rather than about the notification." },

  { "id": "R2-a-manager-still-cannot-override-a-grade",
    "item": "The only response to a dispute is words. A manager who listens back and AGREES can re-score the whole pitch or write 'you are right', and nothing about the score changes.",
    "why_skipped": "An override is a founder decision (§6): it needs a rule for a leaderboard that has already been published, and a record of who changed what from what.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T15:01:00Z",
    "outcome": "OPENED and reserved for a picker, unchanged from the queue build. It is now the sharpest edge in the feature rather than a theoretical gap: this build makes the reply VISIBLE, so the most common real case — a manager agreeing — now reads to the rep as 'you are right' followed by a score that did not move. Before this build that contradiction was at least invisible. Making a thing visible makes its missing half visible too, which is correct, and it means the override is the next thing the founder will want." },

  { "id": "R3-the-rep-sees-their-own-disputes-only-on-one-pitch-at-a-time",
    "item": "A rep with three open disputes across three pitches must open three pitches to see them. There is no list.",
    "why_skipped": "The rep's Progress board is where such a list belongs and it is Project 2, unbuilt.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T15:02:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. It looks harmless because disputes should be rare. The reason it may not be: they will be least rare in exactly the situation that matters most — the first weeks after launch, while the scorer is being calibrated and a rep is checking whether the thing can be trusted at all. That is the moment a rep has several open at once and no way to see them together, and it is also the moment their judgement of the whole product is being formed." },

  { "id": "R4-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried unchanged for the fifth build. Guide page 2 names it as holding Project 1's full scoring detail; it has never been read.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T15:03:00Z",
    "outcome": "OPENED. Nine decisions now stand that the absent document may already have settled. The §0.1 precondition has been unmet for the whole of Project 1, every build widens the surface that would have to be revisited, and this entry exists so the cost is visible rather than absorbed." },

  { "id": "R5-no-human-has-used-any-of-this",
    "item": "Five builds, closed loop, 4,653 tests. No real pitch has been scored, no real dispute filed, no real reply written, and no browser has rendered any of the four surfaces.",
    "why_skipped": "Requires the founder's go-ahead to run a real recording against live DeepSeek, and an environment to open the app in.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T15:04:00Z",
    "outcome": "OPENED, and it is the honest headline for the whole day. Everything built is proven against fixtures and mutations, which establishes that the logic does what it was written to do and says nothing about whether the workflow is the right one. The first real use will be the first evidence about the questions that actually decide this feature: whether a rep can describe what the scorer got wrong in a text box, whether a manager can answer without re-listening to the whole recording, and whether the model grades thirty elements consistently against a real door transcript." }
]
```
