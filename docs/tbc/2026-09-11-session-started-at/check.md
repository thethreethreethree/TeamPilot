# CHECK - a session should be dated when the conversation happened

## Findings

### F1 - a session recorded days ago was dated the day it finally uploaded
class: wrong-instant-recorded (a stored fact about WHEN is taken from the moment of writing rather than the moment of happening)
sweep: read the create route's schema, then grep the app's upload path for what it sends; confirm the column default in the data layer
severity: medium

`POST /api/coach/sales-session` never accepted a start time, so `started_at` is the database
default, which is the insert. The web is unaffected and always was - a session there is created as
the rep begins talking. The phone is the case this breaks: the recorder's own footer says
"Recording stays on this phone until it is sent, so you can record with no signal", so the create
route is reached at UPLOAD.

Measured rather than supposed: the longest a real recording has waited in this product is 47 days,
from the recovery sweep's own record of 2026-09-10.

### F2 - it was masked by a different defect, and unmasking it is what surfaced it
class: defect-hidden-by-defect (one fault kept a second one from ever being reached)
sweep: trace why the phone's held recordings were not sending, then ask what changes when they do
severity: low

Recordings could not leave the phone until a name was typed, so almost none arrived. The two
September sessions that did were recorded and uploaded minutes apart, where the insert time and the
conversation time agree. Removing the name gate on 2026-09-11 means a backlog spanning many days
uploads in one sitting, and every one of them would have landed on the same date.

Worth recording because the ordering is the lesson: the second defect was only findable by asking
what the FIX changes, not by looking at the system as it stood.

### F3 - the fix's own input cannot be trusted
class: untrusted-client-value (a decision taken from a number the client controls)
sweep: consider both directions of a wrong device clock and what each does to a time-ordered list
severity: medium

The instant comes from a phone's clock. Ahead, a session pins itself to the top of every list
ordered by time and stays there; behind, a conversation is filed where nobody will look again.
Bounded and refused rather than clamped, matching `spokenAtFor`'s handling of an absurd audio
offset. The fallback is the column default - that is, precisely today's behaviour - so an untrusted
claim costs nothing that was not already being paid.

## What I did NOT do

The fifteen recordings already waiting on the founder's phone will only be dated correctly if they
upload from a build that carries the app half of this. Build 18 was already building when this was
found. That is stated in the closure rather than glossed: this fix is for the uploads that happen
after it ships, and whether it reaches those fifteen depends on which build they install first.

## Verification

  $ npx vitest run src/lib/coach/v5/__tests__/sessionStartedAt.test.ts
  Tests  9 passed (9)

  $ npx tsc --noEmit            # both repositories
  exit 0

  $ npm run check
  CHECK EXIT: 0
