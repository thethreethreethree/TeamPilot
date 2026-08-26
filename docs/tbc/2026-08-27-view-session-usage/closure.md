# CLOSURE — View session usage (urgent founder fix)

## What shipped
The manager "view session" now shows rep USAGE, not just recent audio recordings. The roster shows each rep's session
count + last-active over 30 days; opening a rep shows all their recent sessions (date, status, and a recording tag
where audio exists, with Save). The three reported reps (Knute Knudtson, Anthony, John Knudtson) — who had used the
product heavily but whose sessions had no stored audio and were older than 2 days — now appear with their real usage.
The old audio+2-day `/recordings` endpoint is untouched.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). PLUS the decisive check: a read-only diagnostic against real prod data shows
the new view surfaces Knute's 44 sessions (old view: 0) and team-activity lists all three reps with last-active dates.

## The un-named reliance
- **The new view reads sessions via the admin client, gated by the SAME manager+same-company authz as `/recordings`
  (isSalesCoachManager + canManagerViewRepSkills).** That gate is unit-tested; if it ever weakened, a manager could
  read another company's activity — so the fix deliberately reuses it rather than re-deriving the check.

## Flag for the founder (needs your action — not a code fix)
Alejandro Salazar is under a SEPARATE company, "ASP" (b2feb3b2), not "Align Sales Pros" (28203036), and has 0 sessions
there. That's why he never appeared. He needs to be added to / moved into Align Sales Pros to show up and start
recording. Moving a user between companies is a data change + your decision, so it is surfaced here, not done silently.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The usage window is 30 days; older activity isn't shown, and there's no per-day usage chart.",
    "why_skipped": "30 days answers 'are they using it, how much, when' for a monitoring glance; a longer window or a usage chart is additive over the same read, not a correctness gap.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T06:40:00+08:00",
    "outcome": "OPENED + bounded: the reported reps now show their real usage; window/chart depth is additive, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "Why the reps' sessions have no stored audio is not addressed here.",
    "why_skipped": "Their sessions are Aug 17-18, predating the iOS capture fix (34a8ab71); new sessions capture audio. This fix restores VISIBILITY of usage regardless of audio; the capture class was already fixed separately.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
