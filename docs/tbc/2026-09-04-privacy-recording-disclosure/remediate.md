# REMEDIATE — fixes, and whether each is a gate or a promise

### F1 — the policy never mentioned the recording

What changed: a new `Recorded conversations (Sales Coach)` section — user-initiated, the other party is audible,
who can hear it, what is derived.

gate-or-promise: promise, declined deliberately under A33

There is no precise check for "this legal document describes this system". A gate would have to know which code
changes are user-visible enough to need disclosure, which is a judgement, not a pattern. Anything cheaper — say,
failing when `src/lib/**` changes and `privacy/page.tsx` does not — would fire on every refactor, and a gate that
fires on every refactor is one people learn to click past. That is exactly the noise A33 forbids.

**The honest replacement is a trigger, not a check:** when a feature starts sending user data somewhere new, the
privacy policy is part of that feature's definition of done. It is written into `APP-STORE-SUBMISSION.md` next to
the App Privacy table, which is the document someone will actually open the next time this question arises — rather
than in a comment nobody has a reason to visit.

### F2 — a sentence that had become false

What changed: the Anthropic entry now states the exception instead of asserting a blanket claim.

gate-or-promise: promise, declined

Same reasoning, and worse odds: a check that could detect "this sentence used to be true" would need to understand
the sentence. What makes this class survivable is that it is found by **reading the whole document**, which cost
about two minutes here and produced two of the three findings.

### F3 — three processors undisclosed, not one

What changed: ElevenLabs, Postmark and Sentry added to "Third-party services we use".

gate-or-promise: promise, but this one is nearly gateable and it is worth saying why it was still declined

A check *could* list every third-party HTTP endpoint constant in `src/lib` and require each host to appear in the
policy. It would have caught all three. It would also fire on every internal service, every CDN, every OAuth
discovery URL and every test fixture — and a maintainer whose only escape is an allowlist will add to the allowlist
rather than to the policy, which produces a file that says a check passed while the disclosure got worse.

**What is recorded instead** is the command, in check.md, so the next person sweeps in the same direction — from
the code towards the document. The reverse direction only ever confirms what is already written, which is why the
omission survived this long.

### What was deliberately not written

gate-or-promise: declined, and escalated

**Audio retention and self-service deletion.** Neither is in the repository. A retention period invented here is a
promise the business has not made, in a document people are entitled to rely on, and the fact that it would be
convenient for the App Store submission is precisely why it must not be guessed.

Marked in the file's header comment and raised to the owner as a question rather than an answer.

### The standing legal review

gate-or-promise: declined — this is not a defect to fix, it is a standing obligation restated so it is not
quietly assumed satisfied

The file has said `NEEDS LAWYER REVIEW` since v0.1. This build makes the document describe the system; it does not
make it compliant, and a reader of these notes should not infer otherwise from the fact that a careful engineer
touched it.
