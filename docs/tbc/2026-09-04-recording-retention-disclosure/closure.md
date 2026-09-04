# CLOSURE — recording retention and deletion on the privacy page

## What shipped

Four bullets in the recording section of `elostate.com/privacy`, saying how long the audio is kept, what keeps a
recording longer, and that no one can delete a specific recording on demand.

Every sentence is traceable to a file. The rule is **not a duration**: each representative's twenty most recent
unsaved recordings keep their audio, a nightly job deletes the rest, and a saved recording is exempt indefinitely.

## What this build actually corrected

Yesterday's version of this page said those two facts "could not be read out of the code" and needed a founder
decision. **They could.** `recording-purge-cron` had been running nightly since 26 August. I published a claim
about the codebase that I had not checked, on the one page where an unchecked claim is a legal exposure.

The founder's answer today is what sent me looking, so the fix arrived by luck rather than by a gate. Recorded
plainly because that is the difference between this being an incident and being a near miss nobody wrote down.

## Checks — commands, not moods (§3.2.3 / A38)

The canonical gate is pasted in check.md with its exit code (0; 4,075 tests). `tbc:freshness` refused the first
commit attempt because this build directory did not exist yet — noted there as the gate working.

## The un-named reliance

- Relies on the cron actually running on Vercel. `vercel.json` schedules it; nothing in this repository proves it
  fired last night. A policy statement about a nightly job is only as true as the scheduler.
- Relies on `KEEP_PER_REP` staying 20. Nothing links the constant to the sentence that describes it.
- The mobile repository now restates the same rule by hand, in `APP-STORE-SUBMISSION.md`. Two repositories, one
  fact, no mechanism keeping them together.
- The page says the phone's copy is deleted after upload. That is the mobile app's behaviour, asserted here from
  the app's own code — a cross-repository claim this repository cannot check.

## Residual (§4 / A36 — read from the top of the confidence ranking)

```json
[
  {
    "id": "R-2026-09-04-17",
    "item": "Whether the recording purge cron has actually been firing on Vercel, or is merely scheduled.",
    "why_skipped": "Needs the Vercel dashboard or production logs, which are outside this repository.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  },
  {
    "id": "R-2026-09-04-18",
    "item": "The changed section as a browser renders it.",
    "why_skipped": "Needs the site running; the gate proves it compiles, not that it reads well.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-04T08:30:00+08:00",
    "outcome": "Opened because the confidence was high, which is the rule. Re-read the committed JSX rather than trusting the diff: the four bullets are <li> children of the same <ul> as the existing three, each opening with a <strong> lead-in exactly like its neighbours, and every apostrophe and quote is an HTML entity as the rest of the file does it. The structure cannot render differently from the bullets already above it. What this does NOT establish, and the residual above keeps: whether seven bullets in one list is now too long to read, which is a judgement only a person looking at the page can make."
  }
]
```

## For the owner

Branch `recording-retention-disclosure`, off `main`, nothing merged.

**Two things in it are facts you do not currently have**, both in check.md as F2:

1. **Nobody can delete a recording** — not a rep, not a manager, not an administrator. There is no endpoint.
2. **A rep can already keep their own recording forever.** `save-recording` authorises the owning representative as
   well as a manager, so a rep can exempt their own recording from the nightly deletion. That is the opposite of
   the policy you described, and it is live.

Making your stated policy true — managers and admins can delete, reps cannot exempt — is a real piece of work: an
endpoint, an authorisation check, the storage removal, and a control on the web. It is not needed to submit to
Apple, because the page now describes what the system does rather than what it should do.
