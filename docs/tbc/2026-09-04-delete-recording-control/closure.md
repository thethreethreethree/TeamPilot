# CLOSURE — a manager can delete a recording

## What shipped

`POST /api/coach/sales-session/[id]/delete-recording` — a manager or an administrator can have one recording's
audio removed. The transcript, the scores and the coaching notes stay.

Plus the thing that made it safe to write: `removeRecordingAudio`, which now owns the only code in this repository
that deletes recording bytes. The retention cron calls it too, and the cron's own nine tests — written before this
refactor existed — pass unchanged.

## Why this build happened at all

It came out of writing a privacy policy. The founder described a rule — *"a rep can't delete their own, only
managers and admins"* — and going to write that down turned up the fact that **neither half of it was true**: there
was no delete endpoint for anyone, and `save-recording` already lets a rep exempt their own recording from the
nightly purge forever. This builds the half that grants the capability.

## Checks — commands, not moods (§3.2.3 / A38)

`npm run check` is pasted in check.md with its exit code. Two mutations, both CAUGHT: removing the manager gate,
and letting a storage failure through to clear the pointer anyway.

## The un-named reliance

- Relies on the service-role key being permitted to `remove()` objects in `assets-v1`. Never exercised against a
  live project — every storage call in the tests is a fake.
- Relies on `isSalesCoachManager` continuing to mean what it means. If a `staff` rep ever satisfied it, they would
  gain a delete they are specifically meant not to have.
- Relies on `audio_asset_url` staying bucket-relative for rows this endpoint is pointed at. Anything else is
  refused rather than guessed, which is the safe direction, but it means a manager could be told a recording
  "cannot be deleted automatically" with no way to escalate from the UI that does not exist yet.
- **Nothing ties the privacy page's new paragraph to the route that makes it true.** Named in remediate.md.

## Residual (§4 / A36 — read from the top of the confidence ranking)

```json
[
  {
    "id": "R-2026-09-04-19",
    "item": "Whether the mobile app has any surface that would now show a manager a delete control, or would break on a session whose audio_asset_url went null under it.",
    "why_skipped": "Different repository; this build is web-only.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-04T09:20:00+08:00",
    "outcome": "Opened because the confidence was high, which is the rule. Read the app's recording path rather than assuming: `sync/recording-url.ts` signs a URL from the session row's audio_asset_url and CACHES it in memory only, and `recording-url-cache.ts` is per-session. A recording deleted server-side leaves audio_asset_url null, which the app already treats as 'no recording on this session' — the same state as a purged one, which happens nightly and is therefore already the well-trodden path. No app change needed. The one real edge: a rep holding an already-signed URL in memory could still play a recording a manager just deleted, until the screen is left. Bounded by the signed URL's own expiry and by the cache being in memory, so it does not survive a restart. Worth knowing, not worth blocking on."
  },
  {
    "id": "R-2026-09-04-20",
    "item": "The endpoint has never been called against a live Supabase project — every storage interaction in the tests is a fake.",
    "why_skipped": "Needs a real project, a real recording, and a manager account. Destructive by nature, so it cannot be tried casually against production data.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": null
  }
]
```

## For the owner

Branch `delete-recording-control`, stacked **on top of** `recording-retention-disclosure`. That stacking is
deliberate and is the fix for a real finding: off `main` the two were independent, and merging them in the wrong
order would have published a privacy policy that contradicted the code. As stacked, there is no bad order.

**Merge `recording-retention-disclosure` first, then this.** Or merge this one, which contains both.

**It has a button now**, on the manager's rep-activity list beside Save, with an inline confirmation that says
what is lost and what survives. Two mutations prove the two properties that matter: one click never deletes, and
the row does not change until the server says it did — a manager must never be told a customer's audio is gone
when it is not.

**The other half of your rule is still open.** A rep can exempt their own recording from deletion via
`save-recording`. Narrowing that removes something reps have today, in the week you are submitting the app — so it
is on your board rather than done here.
