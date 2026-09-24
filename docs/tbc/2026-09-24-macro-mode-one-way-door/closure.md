# CLOSURE — a rep could turn Macro Mode on and not turn it off

## What is true now

The Macro mobile home carries "Exit Macro Mode" in its header row, above the pager, beside "Back to
ELOSTATE" — visible on page 0 and page 1, on every launch. The full toggle card stays where it was.

And five routes that wrote a per-user preference now check that the write landed instead of echoing
the request back.

## Why the first fix was not the answer

I found a genuine defect in the same feature within minutes — the POST reported success on a
zero-row write — and it would have been easy to ship that and call the report closed. It is real,
it is fixed, and **it is not what the founder hit.**

The difference only appeared because the picker asked which of three symptoms they were seeing and
they described a fourth. "It disappeared and I can't see the button and the system remains in MACRO
mode" is not "it didn't save". One sentence from a person using the product beat an hour of reading
it for correctness.

## The shape, for the third time today

- `pitch_scores`: engine, writer, schema and page all correct; nothing called them.
- `ThemeToggle`: complete, tested, cross-device; unreachable from an entire module.
- `MacroModeToggle`: renders, works, wired — and on a phone you cannot get to it.

Three instances of one question, which is not *does this exist?* but *can the person get to it?*
A31 names it and its first example is a settings page with no nav entry.

Here it is sharper than the other two, because nothing is missing at all. Every part is present and
correct. The trap is made of three deliberate decisions — the pager, the toggle's placement on
page 1, and opening on page 0 every launch — none of which is wrong, composing into a state a rep
cannot leave. That is the §1.5.1 layer-3 failure in its purest form: the seam, not the parts.

## Residual

```json
[
  {
    "id": "R1-the-founders-instance-is-inferred",
    "item": "The mechanism explains the founder's exact words and the code is unambiguous, but nothing here ran against their account or session.",
    "why_skipped": "No production access from here.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T05:30:00Z",
    "outcome": "OPEN until they say the button is back. If they are still stuck after this ships, the diagnosis was wrong and the next step is their session rather than more reading — and I would want to know that quickly rather than assume the fix took."
  },
  {
    "id": "R2-two-other-mode-flags-unchecked",
    "item": "`experience_mode` and `learning_mode_enabled` are per-user flags that also change what the UI shows. Whether either can hide its own off-switch was not verified.",
    "why_skipped": "Each needs turning on and looking from inside, which is the only check that works for this class.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T05:30:00Z",
    "outcome": "OPEN, and the macro case is the argument for doing it. That one took a founder report to surface — reading the code for correctness did not and could not find it, because every part was correct."
  },
  {
    "id": "R3-twenty-five-unverified-false-ok-writes",
    "item": "30+ API routes call .update() without checking rows affected. Five on `profiles` were verified and fixed; ~25 across finance, tasks, schedule, chat and care are unexamined.",
    "why_skipped": "Each needs adversarial verification — a service-role client writing zero rows means something different from a caller-scoped one.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T05:30:00Z",
    "outcome": "OPEN, and it is a SUSPECT LIST, not a defect list. Saying '25 more bugs' would be the grep talking. What is true is that 25 places cannot currently tell a successful write from a declined one."
  },
  {
    "id": "R4-the-screen-by-screen-render-pass-has-not-started",
    "item": "The founder chose 'render every Sales Coach screen and look' as the way to find the rest of the bugs. One screen has been rendered.",
    "why_skipped": "This fix came first because a rep stuck in Macro Mode cannot use the product at all.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T05:30:00Z",
    "outcome": "OPEN AND EXPLICITLY REQUESTED. It is the next build. The capture harness exists and has now found two real things — a blank tab and a one-way door — plus one false alarm that was its own wrapper, which is the accuracy to expect from it."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Two screenshots of the Macro mobile home were generated into the scratchpad from this project's own
components; both were opened and described, including the first one whose apparent defect was my
own harness.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs
in that folder, and every Sales Coach screen except this one.
