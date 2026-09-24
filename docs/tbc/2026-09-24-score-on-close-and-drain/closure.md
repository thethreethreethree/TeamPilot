# CLOSURE — the pipeline that was a button

## What is true now

A sales session that finishes is scored. A company's unscored history can be drained by a manager
who sees the count before spending anything. Pattern detection runs on both paths, because it lives
inside the scoring authority rather than inside one route.

Before this, `pitch_scores` had one writer, reached by one caller, which was a button on one
session page.

## What is NOT true yet

**John's Recordings list is still empty.** This build gives it a way to fill; it has not filled.
Somebody has to open Coach Assessment and drain the backlog, and nobody has yet — and there is no
surface that shows the count or starts the drain, because the routes landed and the button to press
them did not. That is residual R1 and it is the difference between shipping and delivering.

## The thing worth keeping

The codebase solved this class twice before and did not generalise either time.

`pitch-score/route.ts:21`, on Project 1's engine having no trigger: *"4,497 green tests described a
system that had never scored a real pitch."* That was fixed with a button, and the button was the
same bug one layer out.

`recover-transcripts-cron`, on 10 September: nine sessions with audio and no transcript, *"nothing
had ever tried"*, and an explicit note that an on-open trigger would have left all nine where they
were. That was fixed for transcripts only.

Both fixes were correct. Neither asked whether the shape existed elsewhere, and both times it did.

## Residual

```json
[
  {
    "id": "R1-the-routes-have-no-button",
    "item": "GET returns the unscored count and POST drains a batch, and nothing in the UI calls either. A manager cannot start the backfill from any screen.",
    "why_skipped": "The founder's next message moved to the theme toggle, and shipping the routes verified is better than half-shipping a surface too.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T05:10:00Z",
    "outcome": "OPEN AND IT IS THE WHOLE POINT. Without it this build changes nothing John can see — it is a capability with a read, a writer and no door, which is a sentence this project has committed before under that exact title. The surface is small: a count line and one button on Coach Assessment that loops POST while `more` is true, showing the refusal reasons when it stops."
  },
  {
    "id": "R2-nothing-ran-against-a-real-database",
    "item": "Every test mocks fetchAllPaged and scoreSession. The candidate query, `pitch_scores.session_id` being populated on historical rows, and a real grading finishing inside 300s eight times over are all unverified.",
    "why_skipped": "No production access from here, and the local Postgres has no real sessions.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T05:10:00Z",
    "outcome": "OPEN. The contract is tested and the query is not. If `session_id` turns out to be null on older rows, the anti-join treats every one of them as unscored and the drain re-grades the entire history at full cost — the single most expensive way this build could be wrong, and it is one SQL query away from being known."
  },
  {
    "id": "R3-detection-over-a-burst-backfill",
    "item": "runDetection reasons over a rep's last 10 applicable pitches. The drain creates them oldest-first in batches of eight, so detection runs repeatedly over a window that is being filled out of order relative to how it would have filled live.",
    "why_skipped": "Needs reading runDetection's windowing against a realistic backlog, which is its own piece of work.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T05:10:00Z",
    "outcome": "OPEN. Worst case is patterns opening on a stale window and clearing immediately, which is noise rather than damage — but it would be noise on the first screen a manager sees after the backfill, which is the worst possible first impression of a feature that has never worked."
  },
  {
    "id": "R4-the-cost-was-decided-against-this-codebase-s-own-precedent",
    "item": "The founder chose to score the whole history in one pass. recover-transcripts-cron caps at 6 per hour explicitly so a backlog 'drains over several hours rather than one unplanned bill'.",
    "why_skipped": "Founder's call, made with the trade stated.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T05:10:00Z",
    "outcome": "CLOSED BY DECISION, recorded so it is not re-litigated or quietly re-decided. The batching and the free count are the parts of that precedent that survived; the pacing is not, on purpose."
  },
  {
    "id": "R5-light-mode-icon-unverified",
    "item": "The theme toggle was rendered and opened in both themes, but the capture forced matchMedia to resolve dark, so both screenshots show the moon icon. The sun state was never looked at.",
    "why_skipped": "A second capture with the resolution flipped, not done.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T05:10:00Z",
    "outcome": "OPEN and genuinely small — ThemeToggle is used in three other places in the product and its light state is not new code. What WAS verified is that the button renders legibly on a light ground, which is the part this build changed."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Two screenshots of the TopBar were generated into the scratchpad from this project's own
components; both were opened and described before any claim was made about them.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs
in that folder, and every surface in this project running against a real database in a real
browser — including the one this build exists to fill.
