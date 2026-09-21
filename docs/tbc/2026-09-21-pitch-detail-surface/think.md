---
started_at: 2026-09-21T13:20:00+08:00
trigger: The previous build's R2 — the route returned JSON no screen consumed, and a rep could not reach any of it. Also: the rubric screen already told reps to "tap Dispute", with nothing behind it.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a score a rep cannot contest is a verdict, not coaching

## Why (the record)

Two residuals, one build.

**R2 from `2026-09-21-pitch-score-trigger`:** *"The route returns JSON that no screen consumes. A
rep cannot reach any of this; curl can."*

**And a live promise with nothing behind it.** `ScoringRubricSheet` shipped earlier in this session
carrying the rubric's own competition rules, including: *"A pitch never scores below 0. Think a
score is wrong? Tap Dispute on the pitch."* That text is in the product now. There was no Dispute,
no route, no event — nothing. The product was telling reps to do something that did not exist.

That second one is the more serious of the two and it was found by reading back what had already
been shipped, not by a new requirement. It is §1.5.1 layer 3 at its sharpest: the feature (the
rubric sheet) works perfectly and leaves the user at a dead end it created itself.

## The design is the deliverable (§1.5.4)

I opened page 3 of `EloState Rep Pitch Dashboard.pdf` and read it rather than working from the
filename or from memory of the earlier session.

What it shows: a near-black phone screen with a yellow accent. A header reading *"Pitch · Fri 18
Sep"* with *"4:12 PM · 11 min recording"* beneath. A **PITCH SCORE** card — 106.5 in large yellow,
a "Strong" pill outlined in yellow, then three boxes: 86.5 Base, +22 Bonus in green, −2 Violations
in red, and a grey footer line *"Counted toward Week 38 Showdown"*. Then **BASE BY SECTION**, six
rows of "Introduction 12 / 16" style figures. Then **CLOSE · ELEMENT DETAIL — 13.5 / 15**, five
rows each carrying a coloured grade badge (green HIT, amber PARTIAL), the element name, a grey
line of evidence beneath it, a yellow outlined play chip like *"▶ 6:48"*, and the points at the
right. Below it, in grey: *"Every section opens to this view: grade, what the AI heard, and the
moment in the recording."* Then **BONUSES EARNED** (same row shape, green +points), a grey note
*"Missed this pitch: Wireless +5, ADT +5, referral +5"*, then **VIOLATIONS** in a red-tinted card,
and finally a full-width yellow outlined **"Dispute a score"** button with *"Goes to your manager
with the timestamp. Changes are logged."* underneath.

The founder specified this. Per §1.5.4 the specified experience is layer 2, not deferrable polish.

### The contradiction the design creates, noted rather than silently applied

The app's palette is **deliberately mono-amber**. `globals.css` is explicit: `--error: #854D0E`
with the comment *"burnt amber, no red"*, and `--success: #FDE047`, which is yellow. The design
uses **green for HIT and bonuses, red for violations**.

Checked rather than assumed: `scripts/theme-audit.mjs` flags only **pale** tints
(`text-*-100/200`), because those hold on dark and vanish on light. Saturated green and red are
not leaks. So the contradiction is narrower than it first appears — the mono-amber rule governs
the app's *chrome*, and it does not forbid colour used as *data*.

Resolution taken, and stated: grade colour is information, not decoration, so it stays. But it is
never the only channel — every badge also carries the WORD (HIT / PARTIAL / MISSED), because a
red-green distinction is invisible to roughly one man in twelve and the grade is the entire point
of the row. Tokens are `emerald-600/700` and `red-600/700` with dark-mode variants, so they hold
on both grounds.

## The one way this screen could undo yesterday's work

Show section totals by summing the element rows.

That is the obvious implementation, and it is wrong on every objection-free pitch: the rows are at
raw rubric weight while Delivery was scored out of 27 and scaled to 35. The screen would contradict
the score printed at the top of itself. Migration 0254 exists to prevent exactly that; doing it
here re-introduces it one layer up, which is precisely the recurrence residual R4 of the
persistence build predicted ("the next person to build the Breakdown screen will sum element rows
because that is the obvious thing to do").

So the fixture in the render test is built to **disagree** — stored Delivery 19.2 against element
rows summing to 7.5 — and asserts both halves.

## Dispute: an event, and not a re-score

Two constraints pull against each other and both are real.

A score a rep cannot contest is a verdict, not a coaching tool, and the whole scoring design
(evidence on every element, a timestamp on every claim, the rejected-bonus confidence preserved
rather than dropped) only pays off if there is somewhere to point at it.

But a dispute that changed the score would let a rep edit their own leaderboard position by
complaining, which destroys the only thing that makes the number worth anything.

So the route appends an event and writes no points, and the form says so in as many words. §3.1
governs cleanly here and, unlike the scoring evidence rows, with no tension: a dispute IS a domain
event — someone said something, at a time — so it appends and never updates. A manager's response
will be a second event and the thread is the two in order.

## Layers (§1.5.1)

1. **Structure** — `PitchDetail` is pure presentation over `StoredPitch`; `PitchScorePanel` owns
   the state machine and the fetches; the page contributes one conditional element. Nothing in the
   existing session page was restructured.
2. **Effectivity** — five distinct states, no shared error box. The engine's four failure modes
   mean different things to the person reading them, and collapsing them into "Something went
   wrong" would discard the entire reason `generatePitchScore` returns a union instead of a zero.
3. **Composition** — the panel sits BESIDE the existing review and scores, which the guide
   requires ("the letter grade and skill scores stay as they are"). It renders only for a finished
   *sales* session, so a huddle never offers a button that 409s the person who presses it.
4. **Surface** — built to the read design, in the app's tokens.

## Session-read manifest

Every clause below was opened in THIS session, from the file named, at the line range given.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The Dispute requirement was not derived from a request. It came from reading back what had already shipped — a rubric screen instructing reps to tap a control that did not exist." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The methodology governing this work must be in the tree and read now.",
    "how_this_build_will_embody_it": "The design source WAS in the tree and was opened — page 3 of the rep dashboard PDF was rendered and described before any styling decision, not recalled from the earlier session. The Pitch Score implementation guide remains absent; carried as residual R4." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Read the problem as a detached observer with no stake in the existing assumptions.",
    "how_this_build_will_embody_it": "The mono-amber palette rule was checked against the audit script rather than obeyed or overridden from memory. It turned out to forbid pale tints only, which is a narrower rule than either side of the argument assumed." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "The session page is large and works. The change to it is one import, one optional type field, and one conditional block; everything else lives in new files. The type field was added because the API already returned sessionKind and only the local type omitted it." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Four layers, foundation up; layer 3 asks whether the feature leaves the user able to continue.",
    "how_this_build_will_embody_it": "The trigger for half this build IS a layer-3 failure the product already shipped: the rubric sheet works perfectly and dead-ends the rep it just instructed. Also why the Dispute control is hidden entirely rather than disabled when unavailable." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Two findings came from looking rather than being told: the shipped-but-unbacked Dispute promise, and bg-brand-fill — a token I had invented, which Tailwind does not define, and which would have rendered the primary button with no background at all." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T13:25:00Z",
    "why_it_governs": "A user-SPECIFIED experience is layer 2 — the intended result — not layer-4 polish that can be deferred.",
    "how_this_build_will_embody_it": "The grade colouring is the founder's specification, so it is built rather than filed as a follow-up. It is also why the palette contradiction was resolved in the design's favour and documented, instead of being quietly dropped to keep the mono-amber rule tidy." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Consume the verdict; do not re-derive it.",
    "how_this_build_will_embody_it": "Section totals, the qualifying verdict and its reason are all rendered from stored fields. Summing element rows for the section figure is the single way this screen could have undone migration 0254, and it is the mutation the render test is built to catch." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Everything is an event, append-only.",
    "how_this_build_will_embody_it": "The dispute appends `coach.pitch_score_disputed` and updates nothing. Unlike the scoring evidence rows, there is no tension here — a dispute is a genuine domain event, and the manager's reply will be a second one." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T13:26:00Z",
    "why_it_governs": "Guide, don't overtake — make the human a participant in the diagnosis rather than handing down a conclusion.",
    "how_this_build_will_embody_it": "This is the product-behaviour clause the Dispute route satisfies. A score delivered with evidence and no way to answer back is the System asserting its conclusion; the dispute is what makes an accurate-but-unwelcome grade socially survivable." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Measure consequence, not agreement; hard metrics must stay defensible.",
    "how_this_build_will_embody_it": "The dispute writes no points. A complaint that moved the score would make the leaderboard a measure of who objects loudest — agreement rather than consequence, which §3.5 calls grading your own homework." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "The biggest risk is the builder under pressure making it less honest for a faster result.",
    "how_this_build_will_embody_it": "The build:ci failure was the test. The fast move was to call it pre-existing and move on. It was verified instead, by building HEAD in a clean worktree — and it IS pre-existing, which is a finding about main rather than an excuse." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "Item 0 — a decision for the founder is a picker, never prose.",
    "how_this_build_will_embody_it": "The palette contradiction was decided rather than posed, under the founder's standing instruction to build autonomously; the decision and its reasoning are stated in full above so it can be reversed on sight." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Labels without content produce work written in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "bg-brand-fill is this failure in a class name: it LOOKS like this codebase's token vocabulary and is not in it. Caught by counting real usages (110 for bg-ember-400, 2 for bg-brand-fill, both mine) rather than by it looking right." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "The design PDF was re-rendered and described in this session rather than relied on from the earlier compacted context — the same discipline LAW 1 imposes on graphics, and the reason the unreadable instruction image is flagged rather than acted on again." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A lesson in prose returns; encode it in a gate.",
    "how_this_build_will_embody_it": "Twenty-one render assertions and fifteen route assertions, each pinned by a mutation. The dead-control rule is encoded twice — footer button and per-item link — because the first mutation run proved only one of them was covered." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual is the highest-yield queue, and writing it as a disclaimer is what stops you returning to it.",
    "how_this_build_will_embody_it": "Third consecutive build started from the previous build's residual. R4 of the persistence build predicted this exact screen would re-sum element rows; that prediction is what the central render test is written against." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a COMMAND you ran, not a recipe you invented.",
    "how_this_build_will_embody_it": "build:ci was RUN this time, because this build has UI. It failed, on someone else's page, and rather than reasoning that it was unrelated, HEAD was built in a clean worktree to prove it — 381 pages, same page, same error." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1052", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "A decision is returned as a verdict and consumed, never re-derived.",
    "how_this_build_will_embody_it": "Every number on the screen is read: sectionPoints, qualifying, notQualifyingReason, deliveryScaled. The mutation that re-sums section totals from the element rows fails a test." }
]
```
