# CLOSURE — the sentence was true when it was written

## What shipped

Pattern Interrupt's route and screen, committed together with the nav that links to them, and the
sidebar regrouped to the 2026-09-19 boards.

The screen still shows zeros. What changed is why it says it shows zeros: not "the engine has not
landed" — it landed this session — but "the comparison that turns repeated misses into a tracked
pattern has not been built."

## What this build got right, and it was not the code

Reading the screen before committing it. Both files were finished, typechecked and rendering; the
task was `git add`. The only thing between a correct commit and shipping a false promise to a
manager was opening the component and asking whether what it asserts is still true.

The second thing: not building the detector. The inputs exist and the temptation was real — a page
that says "not built yet" is an invitation. But `patterns` and `pattern_events` do not exist, and
the status vocabulary has a recorded contradiction (two screens count *open* differently, C8).
Building over an unresolved definition would put two numbers for the same rep on two screens, which
is a worse outcome than an honest zero.

## The un-named reliance

- **That an honest empty state is enough.** A manager who opens this twice and sees the same
  message learns the page is dead. Nothing tells them when to come back, because nothing knows.
- **That the nav regrouping matches the boards.** Six destinations moved on the strength of my
  reading of the mockups; the mockups themselves are PDFs I extracted text from, not renders I
  looked at.
- **That `My Progress` appearing twice reads as one item.** The flags are complementary so each
  role sees it once — verified by reading the flags, not by seeing a sidebar.
- **That "NEW" is worth a pill.** It is in the boards. It is also the only decorative element in
  the nav, and it will be stale in a month with nothing to remove it.

## Residual

```json
[
  { "id": "R1-thirteen-builds-and-the-sidebar-has-never-been-seen",
    "item": "Six destinations moved group, four role flags changed, a new group was added and a coloured pill introduced — all from reading markup.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T18:34:00+08:00",
    "outcome": "OPENED and it ranks first. This is the navigation — the one surface every other surface is reached through — restructured without being looked at once. The specific thing markup cannot answer: My Coaching now holds six items and Team Tools eight, which is a long sidebar on a laptop, and whether the collapsible headers make that legible or merely scrollable is a question only a render answers. Thirteenth consecutive build with nothing rendered." },

  { "id": "R2-no-gate-relates-a-nav-href-to-a-route",
    "item": "reachability:audit catches a module nothing reaches. Nothing catches a nav entry pointing at a path with no page — the inverse, and the one this build nearly shipped.",
    "why_skipped": "It belongs with the nav change rather than bolted on under time pressure; building a gate badly is how the noisy ones get made.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:35:00+08:00",
    "outcome": "OPENED, and unusually tractable for a residual — every href in NAV_SECTIONS is a string literal and every route is a directory under src/app, so the check is a directory existence test with no heuristic in it. This is the rare case where the gate is easier than the argument about whether to build it. It is named here specifically so it is not carried for six more builds as a disclaimer." },

  { "id": "R3-the-empty-state-cannot-say-when-to-come-back",
    "item": "The screen now says the detector has not been built. It does not say when it will be, because nothing knows.",
    "why_skipped": "Any date would be invented, which is the failure being corrected.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:36:00+08:00",
    "outcome": "OPENED. Replacing an expired promise with a vaguer one would have been the easy move and would have reproduced the defect a step removed. What the screen does instead is describe a present state rather than predict a future one, which cannot go stale the same way — but it leaves a manager with no reason to ever return to the page, and a nav item that is permanently a dead end is its own kind of wrong." },

  { "id": "R4-the-detector-is-buildable-now-and-was-not-built",
    "item": "pitch_score_elements holds the per-element grades, indexed on (company_id, element_id). The detection query has its input. Project 5 remains unbuilt by choice.",
    "why_skipped": "The `patterns` and `pattern_events` tables do not exist, and the status vocabulary has an unresolved contradiction (C8) that would ship as two different numbers for one rep.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T18:37:00+08:00",
    "outcome": "OPENED, and this is the honest scope statement rather than a caveat. The build order's precondition is now satisfied, so 'blocked on Project 1' is no longer available as a reason for anything. What blocks it is a schema decision and a definition decision, both of which are recorded and neither of which is mine to take alone — C8 in particular asks which of two on-screen counts is the real one." },

  { "id": "R5-the-mockups-were-read-as-text-not-seen",
    "item": "The nav grouping, the labels and the NEW pill come from PDFs extracted with pdftotext, not from the renders.",
    "why_skipped": "LAW 1 forbids describing an image from anything but the render, and the renders have not been displayable.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:38:00+08:00",
    "outcome": "OPENED. Text extraction gives labels and order reliably; it gives grouping only by inference from vertical position, and it gives colour and emphasis not at all. The NEW pill's colour was chosen from the sidebar's existing token, not matched to the board. Twice this session reading a PDF properly changed or dissolved a task, which is the argument for treating the extraction as evidence — and the argument for not treating it as sight." },

  { "id": "R6-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the twenty-second build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T18:39:00+08:00",
    "outcome": "OPENED. Twenty-two builds. This one corrected a claim written from a build guide instead of from the migration it described; the image is the same category of asset, still cited in the session's framing and still unread." }
]
```
