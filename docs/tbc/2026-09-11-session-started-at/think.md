---
started_at: 2026-09-11T16:50:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a session should be dated when the conversation happened

## Why (the record)

The founder's REV 1 asked for recordings to be titled automatically. Tracing why they were not
turned up a larger thing: **a recording could not leave the phone until somebody typed a name for
it**. Their own screenshot showed fifteen held, 13.5 MB, and a button offering to send three.

That gate is now gone, which means a backlog of recordings made on many different days is about to
upload in one sitting. Which exposes the next thing along.

## The defect

`POST /api/coach/sales-session` has never accepted a start time. The session's `started_at` is
whatever the database defaults to, which is the instant the row is inserted.

For the WEB that is correct and always was: a session is created as the rep begins talking, so the
insert time IS the conversation time.

For the PHONE it is not. This app exists for reps working in dead zones - the recorder's own
footer says so: *"Recording stays on this phone until it is sent, so you can record with no
signal."* The create route is therefore reached at UPLOAD, not at record. A call recorded on the
4th and uploaded on the 11th becomes a session dated the 11th, and the rep's own history says the
conversation happened on a day it did not.

Measured rather than supposed: the longest a real recording has actually waited in this product is
**47 days** - the recovery sweep's own record from 2026-09-10, whose oldest untranscribed session
dated from 25 July.

## Why it was invisible until now

Recordings rarely reached the server, because of the name gate above. The two September sessions
that did arrive were recorded and uploaded within minutes of each other, so the insert time and
the conversation time agreed. Nothing disagreed loudly enough to be seen.

It also compounds with the title fix in a way worth naming: an unnamed recording is now filed as
*"Door, Thu 10 Sep at 4:53 PM"*, and the sessions list groups by `started_at`. Without this change
that row would sit under a **Today** heading while calling itself the 10th - a screen disagreeing
with itself in one line.

## The hard part, which is the only reason this needs thought

The value comes from a phone's clock, and a phone's clock can be anything. Trusting it blindly is
worse than not sending it:

  * a device set AHEAD pins a session to the top of every list ordered by time, for ever;
  * a device set BACK files a conversation where nobody will look for it again.

So it is bounded and REFUSED rather than clamped, matching how `spokenAtFor` already treats an
absurd audio offset. Clamping would invent a timestamp, and an invented one is indistinguishable
from a real one the moment it is stored. The fallback is `null`, which is the column default,
which is exactly the behaviour that exists today - so an untrusted claim costs nothing that was
not already being paid.

## Session-read manifest

Every clause below was opened in THIS session, after this build's `started_at`, from the file
named - not carried from earlier in the conversation, which is the whole of A22.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-11T16:52:00+08:00",
    "why_it_governs": "Understanding precedes solving; if you cannot say WHY the problem exists you are not permitted to fix it yet.",
    "how_this_build_will_embody_it": "The cause was traced to a specific line - the create route has no startedAt field and the column defaults to now() - rather than inferred from the symptom that fifteen sessions would land on one day." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-32", "read_at": "2026-09-11T16:52:00+08:00",
    "why_it_governs": "The methodology defining understanding must be in the working tree and read now, not cited from memory.",
    "how_this_build_will_embody_it": "These clauses were re-opened for THIS build rather than reused from the timestamps of the previous one earlier in the same session, which would have been a citation without a reading." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-84", "read_at": "2026-09-11T16:53:00+08:00",
    "why_it_governs": "Four layers in order - a broken layer 2 is not survivable by composition or polish.",
    "how_this_build_will_embody_it": "Layer 2 is the whole of it: the feature works, and the result it delivers is a date that is wrong for every rep who records away from signal. No amount of presentation fixes a history that says the wrong day." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-147", "read_at": "2026-09-11T16:53:00+08:00",
    "why_it_governs": "Think first about what else could fail, THEN search to confirm - mechanical grep alone does not satisfy it.",
    "how_this_build_will_embody_it": "This was not found by grepping. It was found by asking what fifteen backlogged recordings would look like once they could finally send, then reading the create route to check." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-437", "read_at": "2026-09-11T16:54:00+08:00",
    "why_it_governs": "Item 1 - understand why, from the record, before acting.",
    "how_this_build_will_embody_it": "The 90-day window is set from a measured 47-day worst case in production, not chosen for feeling about right." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "56-60", "read_at": "2026-09-11T16:54:00+08:00",
    "why_it_governs": "Methodology that governs the build must live in the working tree.",
    "how_this_build_will_embody_it": "Both governing documents were read from this tree in this session; the founder's own rule that a session must be titled was read from the route rather than recalled, and it is what confirmed the automatic title satisfies it." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "56-60", "read_at": "2026-09-11T16:54:00+08:00",
    "why_it_governs": "Constitutional citations without session-reading are undetected violations.",
    "how_this_build_will_embody_it": "Each clause here was opened at the timestamp given, in this build, and the quotes reproduced above come from the files rather than from memory of them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "92-93", "read_at": "2026-09-11T16:55:00+08:00",
    "why_it_governs": "A lesson in prose returns - encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The two refusals are pinned by named tests, and three mutations - trusting a future date, trusting any backdate, and shrinking the window below a real 47-day wait - each fail one." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "96-97", "read_at": "2026-09-11T16:55:00+08:00",
    "why_it_governs": "The word verified is a claim about a COMMAND you ran, reported in the project's own words.",
    "how_this_build_will_embody_it": "check.md reports the commands and their exit codes. Nothing here has run on a phone, and that is said rather than implied." }
]
```
