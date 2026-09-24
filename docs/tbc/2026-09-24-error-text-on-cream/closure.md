# CLOSURE — a correct sentence nobody could read

## What is true now

Ten error messages across the door-log and meeting surfaces are legible on both themes. Dark is
byte-identical to what a rep sees today; light went from pale salmon at roughly 2:1 to a strong red.

## The sentence that was failing

> Couldn't load your pitches — this is an error, not an empty history. Check your connection and
> try again.

That distinction is argued about in half a dozen files in this codebase. `writer:audit`, the
data-layer catch invariant, the RecordingsTab failed-read test, the backlog panel's 500-instead-of-
zero — all of them exist so that a failure is never shown as an absence.

And it was rendered at 2:1 on the theme a rep working outdoors would choose. The argument was won
in the logic and lost at the last inch.

## What connects this to the rest of the day

Three findings now share one shape, and none of them is a bug today:

- `closeRate` carries two units on one payload.
- `outcome` names five different vocabularies across five tables.
- A colour correct on matte black is unreadable on cream, and nothing at the call site says which
  ground it will land on.

Each is a name or a value whose meaning depends on context the call site does not carry. Each is
correct while everyone happens to remember. Each cost me an error today — four from `outcome`
alone — and the errors were expensive in attention rather than in production.

## Residual

```json
[
  {
    "id": "R1-two-of-the-ten-were-never-rendered",
    "item": "The Door Log send-failure banner and mic-stopped alert are fixed by class. I still have not reached those states — three attempts, documented at 05:45.",
    "why_skipped": "The component's state machine does not advance under a mocked recorder, and I stopped rather than keep varying a wrong identification.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T07:20:00Z",
    "outcome": "OPEN. The fix is class-level and the other eight members of that class were verified by rendering one of them, so the risk is low — but 'fixed by pattern' is a weaker claim than 'fixed and seen' and should not be written as though it were the same."
  },
  {
    "id": "R2-paleText-stops-at-200",
    "item": "theme-audit has a category for exactly this family and its boundary is -100/200. Every site here is -300 or -400.",
    "why_skipped": "Widening it would flag correct code on the fixed-dark surfaces this codebase has by design, until those are rendered.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T07:20:00Z",
    "outcome": "OPEN, and it is the second gate deferred today for the same reason as the first. The order is render-then-gate, so the allowlist records things somebody looked at rather than things somebody needed to ship."
  },
  {
    "id": "R3-four-surfaces-unswept",
    "item": "Roleplay, One Liners, Sessions and Analytics have not been rendered, and this class was only grepped there.",
    "why_skipped": "Each needs its own capture and fixture.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T07:20:00Z",
    "outcome": "OPEN. Nine of thirteen surfaces are rendered; the yield across them is eight real defects, four phantoms and three clean screens. That ratio is the honest expectation for the remaining four."
  },
  {
    "id": "R4-five-outcome-vocabularies",
    "item": "`outcome` means five different things across five tables, three of them containing the token `sold`.",
    "why_skipped": "The fix is a rename across four columns or a shared type per vocabulary — a real project, not an afternoon before a demo.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T07:20:00Z",
    "outcome": "OPEN and deliberately not promised. What is recorded is the list, in the fixture that got it wrong. Four of my errors today came from this and none of them reached production, which is the argument for fixing it and also the reason it can wait."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed. Six
screenshots were generated from this project's own components into `artifacts/visual/`
(git-ignored); the failed-read state was opened before and after the fix in both themes, and the
populated state was opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs
in that folder, and four of the thirteen Sales Coach screens.
