# BUILD — the recording retention and deletion facts, on the privacy page

One file: `src/app/privacy/page.tsx`. No runtime code changed.

## The write path and the read path (§3.2.2)

There is no write path — nothing here stores anything. The **read path** is the whole change, and it has two
distinct readers who need different things from the same four bullets:

- **The representative**, who wants to know whether the call they just recorded still exists and whether they can
  get rid of it. They get a straight no on the last one, with the route that does exist.
- **The person at the door**, who never opened this app and is the only party to the conversation with no account.
  This section is the only place the product ever addresses them. Every sentence is written to be true when read
  by someone who is not a customer.

## Features

### Recording retention, stated on the privacy page

**write-path:** none, and stating that is the point. This feature writes nothing — it DESCRIBES a write that
already happens elsewhere: `recording-purge-cron` nulls `coaching_sessions.audio_asset_url` and removes the bytes
from the `assets-v1` bucket every night at 03:30 per `vercel.json`. The failure mode a write-path assertion exists
to catch is present here in its documentary form: a page that describes a mechanism nobody wired up. It is wired
up, it is scheduled, and check.md tabulates each sentence against the line that implements it.

**read-path:** `elostate.com/privacy`, in the existing "When a call is recorded" section — a static server
component, no fetch, no auth. A reader arrives from the site footer or the App Store listing's privacy link, both
of which are public and unauthenticated, which matters because the reader who most needs this section is the
person at the door and they have no account.

### Recording deletion, stated on the privacy page

**write-path:** deliberately none, and this one is the sharper case. There is no delete endpoint under
`src/app/api/coach/sales-session/`, swept and recorded in check.md — so the honest assertion is that no write path
exists for anyone, representative or manager. Claiming a control with no write behind it is exactly the A31
failure, and on a legal page it would also be a false promise.

**read-path:** the same public section, immediately after the retention bullets, then a pointer to the contact
route in "Retention and deletion" so a reader who wants removal is handed somewhere to go rather than a dead end.

## What was added

Four bullets in the existing **"When a call is recorded"** section, beside the ones about who can hear it and what
is derived from it — not a new section, because retention is a fact about the recording rather than a topic of its
own, and the reader is already in the right place.

1. **How long we keep the audio** — each representative's twenty most recent recordings; a nightly job deletes the
   audio of anything older; the transcript, score and notes are kept. The sentence *"we drop the recording, not the
   coaching"* is lifted from the intent of the cron's own header comment, because it is the distinction a rep will
   actually ask about.
2. **Recordings that are kept longer** — Save exempts a recording from the nightly deletion, and either a
   representative or a manager can press it. Stated with both parties named, because `save-recording/route.ts`
   authorises both and a policy naming only managers would be false.
3. **Deleting one** — the product has no delete control for a specific recording, for anyone. Then what a rep CAN
   do: delete the local copy before upload, and the automatic removal of the phone's copy after upload. Then the
   contact route for a removal request.
4. The existing **"the audio itself is kept so a representative can listen back"** bullet was left untouched. It is
   still true, and it is what makes bullet 1 make sense.

## What was NOT added, deliberately

- **No time limit.** A twelve-month cap is recommended to the founder but is not built, so the page does not
  mention one. Publishing an outer bound the cron does not enforce would replace one false statement with another,
  which is precisely the failure this build exists to correct.
- **No claim that managers can delete.** That is the founder's stated policy and would need an endpoint that does
  not exist.

## The file header

The header comment previously said the two facts "could not be read out of the code". It now records what actually
happened — that they could, and that the earlier note was a claim made without opening the file — and carries the
two consequences forward so the next author does not have to re-derive them.
