# CLOSURE — the report I did not send

## What is true now

`closeRate` still means two things on one payload. Both definitions now say which, and a test fails
if either side is changed to match the other without its consumers.

Nothing a user sees changed, and nothing a user sees was wrong.

## The actual event

Hours before an investor presentation, I rendered the path I had just recommended for that
presentation and saw `0.129%` beside `13%`. There is a helper that multiplies by 100; two call
sites use it; the third does not. That is a complete story for a 100x error on the screen a room of
investors would be looking at.

I was one message from sending it.

**It was my fixture.** Thirty seconds of reading the producer — not the renderer — ended it.

## Why this one is worth a closure document

The near-miss is more useful than the finding. Three things lined up:

1. **A screenshot feels like proof.** It is proof about the renderer. The bug I imagined was in the
   data, and a picture of a number says nothing about where the number came from.
2. **The story was internally consistent.** A helper, two correct uses, one bypass. Coherence is
   not evidence, and a coherent wrong answer is the §5 failure mode exactly: *"a fast, fluent,
   well-sourced answer imitates understanding convincingly."*
3. **The pressure was real and pointed the wrong way.** An investor demo makes a dramatic finding
   feel valuable and a retraction feel expensive. It is the reverse.

The same pressure offered a second shortcut: rename the field now, decisively, and close the trap.
That would have changed a wire key on the afternoon of the demo, and a browser on the previous
bundle would have rendered `undefined%` in the room.

Both temptations were the same one — make it *look* handled, faster.

## Residual

```json
[
  {
    "id": "R1-the-rename-is-deferred-not-done",
    "item": "`RepRow.closeRate` → `closeRatePct` is the fix that removes the trap. 19 references, compiler-checked, not made.",
    "why_skipped": "It changes a wire key; a browser on the previous bundle renders `undefined%`. Deferred over an investor demo.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T07:30:00Z",
    "outcome": "OPEN AND SCHEDULED, on the record in three places so it cannot quietly become never. The drift-guard protects the current arrangement and cannot protect a NEW call site that reads `closeRate` and guesses — only the name does that. Any ordinary day is a fine day to do it."
  },
  {
    "id": "R2-four-vacuous-tests-of-my-own",
    "item": "Four tests written today passed while measuring nothing: negative-only assertions passing against a crashed render, an early `return`, a fixture the compiler rejected, and mutants I had to probe by name before trusting.",
    "why_skipped": "\"Does this test measure what it claims\" is not a checkable property.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T07:30:00Z",
    "outcome": "OPEN as a standing hazard rather than a task. The rate is what is alarming — four in one day, in a session spent cataloguing exactly this failure in other people's code. Every one was caught by a step OTHER than running the unit test, which is the argument for the twelve-step gate over the fast one."
  },
  {
    "id": "R3-a-screenshot-is-evidence-about-the-renderer",
    "item": "The visual harness produced three phantom findings today, each from a fixture rather than the product.",
    "why_skipped": "Not fixable — it is a property of what a capture can and cannot witness.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T07:30:00Z",
    "outcome": "OPEN, and it should stay visible next to the harness's real wins. It found a blank tab, a one-way door, an invisible switch and a washed-out total. It also invented a clipped button, a stretched card and a 100x numeric error. A tool with that ratio is worth having and is not worth trusting unreviewed — which is exactly why it has no baselines and fails nothing."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed. The
Coach Assessment captures were generated from this project's own components into `artifacts/visual/`
(git-ignored) and each was opened and described before any claim was made about it — including the
one that produced the phantom.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs
in that folder, and seven of the thirteen Sales Coach screens.
