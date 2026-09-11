# CLOSURE - a session should be dated when the conversation happened

This one exists because of a fix rather than in spite of one. Removing the name gate on the phone
meant a backlog of recordings spanning many days was about to upload in a single sitting — and the
create route has never accepted a start time, so every one of them would have been filed on the day
the phone happened to get a bar.

The web was never wrong here and is unchanged: a session there is created as the rep starts talking,
so the insert instant IS the conversation. The phone is the case the product is actually FOR — the
recorder's own footer promises you can record with no signal — and it is the case where the insert
instant means nothing at all.

The part that needed care was not the plumbing. It was that the new input is a phone's clock, and a
phone's clock can be anything. Ahead, a call pins itself to the top of every time-ordered list and
stays; behind, it is filed where nobody looks again. So it is bounded on both sides and REFUSED
rather than clamped, falling back to the column default — which is to say, falling back to exactly
what happens today. An untrusted claim costs nothing that was not already being paid.

The backward bound is the one number here, and it is measured rather than chosen: 90 days, against
a worst case of 47 actually observed in production. The test pins the relationship, not the figure,
so an edit that tightens it below a real recording's wait fails with the reason attached.

## Residuals

```json
[
  { "id": "R1-the-fifteen-already-waiting-may-miss-this",
    "item": "The founder's fifteen held recordings are dated correctly only if they upload from a build carrying the app half of this change. Build 18 was already building when the defect was found.",
    "why_skipped": "Nothing can be done from here about which build they install first, and re-dating sessions after the fact would mean writing a timestamp from a recording that no longer exists on the device. Saying so plainly is the honest move; quietly hoping is not.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-11T17:05:00+08:00",
    "outcome": "OPENED and acted on rather than noted. A further build carrying this change is the only thing that helps, and it is being made. If the founder installs it before uploading, the fifteen land on the days they happened; if they install 18 first, those fifteen land on one day and every recording AFTER them is correct. Either way nothing is lost that was not already lost before today - the previous behaviour dated everything at upload." },

  { "id": "R2-nothing-fails-if-the-app-stops-sending-the-field",
    "item": "`startedAt` is optional by necessity — a web caller must not send one — so a phone that stops sending it is indistinguishable from a caller that never did, and the server-side tests cannot tell the difference.",
    "why_skipped": "Making it required would break the web, which is the caller for which the current behaviour is correct. The protection belongs in the app's own suite, which exercises its upload path.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-11T17:06:00+08:00",
    "outcome": "OPENED, and it is a genuine hole rather than a theoretical one. The app's upload body is asserted by its own tests, but NOT specifically that `startedAt` is present — so today a refactor there could drop the field and both suites would stay green. What stands in the way is that the field sits inside a documented block explaining why it exists, which is a comment and not a gate. Recorded as the real state rather than closed as covered." },

  { "id": "R3-existing-sessions-are-not-re-dated",
    "item": "Every session already stored carries its upload instant. Nothing backfills them.",
    "why_skipped": "The information needed to correct them is the recording's `recordedAt`, which lives on the device and is deleted once the upload is confirmed. For an already-uploaded session it is simply gone.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null }
]
```
