# CLOSURE — refusing to answer is the feature

## What shipped

The Breakdown board leads with what a rep improved at, measured against their own previous period.
When there is not enough evidence it says so, with the reason and what would fix it. When there is
enough and nothing rose, it says that instead.

R2 of the sweep's closure is closed.

## What this build got right, and it was not the code

Treating the refusal as the feature. The subtraction is four lines; the verdict type, the
threshold, and the insistence that `insufficient` renders rather than falling back are the build.

A board that quietly showed the strength when it could not compare would have passed every test,
looked complete, and answered a question it had not answered. That is the shape this whole
constitution is aimed at, and it was one `??` away.

## The un-named reliance

- **That three pitches is enough.** It is the smallest count at which one pitch cannot dominate,
  which is an argument about arithmetic rather than about coaching. A coach might say six.
- **That the previous window is the right baseline.** The KPI document says agent-vs-their-own-past
  and does not say which past. Last week is the obvious reading and it is not the only one — a
  rolling average, or their first month, would both be "their own past".
- **That two reads are affordable.** This route now does twice the database work on every load, and
  nothing has measured it.
- **That a rep reads three stacked callouts.** Improved, strongest, opportunity. Each is justified
  and nobody has seen them together.

## Residual

```json
[
  { "id": "R1-three-stacked-callouts-and-nobody-has-seen-them",
    "item": "The Breakdown now opens with Most improved, Your strongest, and Biggest opportunity — three bordered callouts before the section list. Two of the three were added today.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T10:10:00Z",
    "outcome": "OPENED because it ranks highest, and it does not survive comfortably. Each callout is individually justified by a clause of the KPI document, which is exactly how a screen accumulates: nobody adds a bad one. Three bordered boxes in a row, two of them coloured, before a rep reaches their actual numbers is a density problem that the last density pass could not have caught because two of the three did not exist yet. Eleventh build with nothing rendered." },

  { "id": "R2-the-threshold-of-three-is-mine-and-unapproved",
    "item": "MIN_PITCHES_FOR_COMPARISON = 3. The rubric has no such constant and the KPI document names the requirement, not a number.",
    "why_skipped": "The document requires SOME threshold; shipping anything meant choosing one.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T10:11:00Z",
    "outcome": "OPENED. The argument for three is about arithmetic — below it a single pitch dominates — and the question is about coaching, which is not the same field. Set too low, the board reports noise as growth to a rep who will act on it; too high and a rep who genuinely improved is told there is not enough to say. It is exported and named so arguing with it costs one constant." },

  { "id": "R3-last-week-is-one-reading-of-their-own-past",
    "item": "The baseline is the immediately preceding window of the same length. The KPI document says agent-vs-their-own-past and does not say which past.",
    "why_skipped": "The obvious reading, and the only one the existing read supports without new aggregation.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T10:12:00Z",
    "outcome": "OPENED. A rolling average would be steadier and less flattering to a lucky week; a first-month baseline would show career growth rather than recent movement. Last-week is the most volatile of the three, which is partly why the threshold and the floor exist — they are compensating for a baseline choice as much as for small samples." },

  { "id": "R4-the-route-now-reads-twice",
    "item": "Every Breakdown load does two bounded reads instead of one. Nothing has measured the latency.",
    "why_skipped": "Both are bounded and indexed; the cost is a round trip rather than a scan.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T10:13:00Z",
    "outcome": "OPENED. The second read is best-effort in the sense that its FAILURE is handled, and it is not optional in the sense that it always runs — including for a rep on 'all time', where previousWindow returns undefined and the read is skipped, which is the one case that costs nothing. A rep opening the board on a phone pays for a comparison they may not scroll to." },

  { "id": "R5-no-real-comparison-has-run",
    "item": "Every verdict in every test comes from a fixture. No baseline has been read from a real pitch_scores table.",
    "why_skipped": "No seeded environment with two periods of scored pitches.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T10:14:00Z",
    "outcome": "OPENED. The seam most likely to be wrong is the window arithmetic against real timestamps — the half-open range is reasoned about and tested against synthetic dates, and a pitch landing exactly on a boundary has never actually existed." },

  { "id": "R6-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the twentieth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T10:15:00Z",
    "outcome": "OPENED. Twenty builds. This one was built entirely from a document I had quoted for four builds before reading — the parallel is exact and the image is still unread." }
]
```
