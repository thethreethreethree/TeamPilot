# CLOSURE — a rep's best pitches had no list

Small route, and the interesting part is how the gap surfaced.

The mobile Progress board was built to the mockup, and two of its drawn elements turned out to have
no data behind them. Rather than invent a competition deadline and three pitch cards, the board
shipped without both and said so in its own docblock. The founder then chose to build one of them.

That is the loop working in the right order: the drawing showed a thing, the build discovered the
thing had no source, the absence was recorded instead of filled, and the decision about whether to
build it was the founder's. The alternative — three plausible cards assembled from whatever was
nearest — would have looked finished and been fiction.

The rule worth keeping from F2 is smaller than the route. "Best" is a word with two candidate
meanings in a product that ranks on one of them, and the failure would not have been visible: a
board ranking by base would have shown three real pitches, in a real order, with real dates,
celebrating work that contributed nothing to the total printed beside it.

## Residuals

```json
[
  { "id": "R1-no-client-has-called-this-over-the-wire",
    "item": "Nine tests exercise the handler against a recording stub. No client has called this route by HTTP, and the mobile board that will consume it has never rendered.",
    "why_skipped": "Wiring the board is the next step; adding the door came first so the board had something to consume.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T16:30:00+08:00",
    "outcome": "OPENED, and it is the same residual the rubric endpoint carries — which is the point worth recording. Two routes now exist that nothing has ever called, and their tests prove only that the handlers behave against mocks. The auth shape matches the five pitch-score routes the app already reaches, which is a reason to EXPECT it works and not evidence that it does. Both stay UNTESTED over the wire until a device runs the boards." },

  { "id": "R2-the-cards-leave-the-app",
    "item": "A best-pitch card links to the WEB pitch detail. There is no mobile detail screen in this revision.",
    "why_skipped": "Founder instruction, recorded in WHATSAPP.txt: page 3 is the web version. The mount is a config line, not a rebuild, if that ever reverses.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T16:31:00+08:00",
    "outcome": "OPENED rather than noted, because the consequence is a rep at a door leaving the app to read why their best pitch scored what it did. That is the correct build of the stated instruction and still a worse experience than the mockup implies, and the difference belongs on the record rather than in a surprise." },

  { "id": "R3-ranking-ties-are-unspecified",
    "item": "Two pitches with identical totals order arbitrarily — Postgres decides, and the order may differ between reads.",
    "why_skipped": "Three cards from a rep's own pitches; an unstable tie shows the same score twice in a different order, which misleads nobody.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T16:40:00+08:00",
    "outcome": "OPENED because it was ranked most-confident-irrelevant, and the confidence was WRONG — which is exactly why the ranking exists. The reasoning treated the cards as NUMBERS. They are LINKS. An unstable tie does not merely reorder two equal scores: when more pitches tie than there are card slots, WHICH pitch occupies the third card changes between reads, so a rep taps '97 points' expecting the pitch they were looking at and opens a different one. FIXED rather than recorded, because the fix is one line: a secondary sort on recorded_at descending, so a tie always resolves to the more recent pitch. A test pins both orders. Second time today that opening the high-confidence residual found something real — the rubric route's cache header was the first." }
]
```

## Not opened

- **"Pitch Score System — Engineering Implementation Guide"**, named on guide page 2 and not in the
  repository. It does not govern this route — no scoring behaviour was added — but it is where a
  stated tie-break rule would live if one exists.
- **No screen was rendered.** The route was exercised by unit tests against a stub only.
