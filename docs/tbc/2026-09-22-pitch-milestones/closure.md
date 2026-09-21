# CLOSURE — the last mapped collision, and two definitions that were nearly invented

## What shipped

Six Pitch Score milestones, defined from the sheet's own captions, on an all-time oldest-first
read, rendered as a strip that shows unearned badges rather than hiding them. The Arena's `spark`
was relabelled from "First pitch scored" to "First session scored".

The two-systems map's last open collision is closed. Every row in that table is now either fixed,
resolved by labelling, or explicitly a founder decision.

## What this build got right, and it was not the code

Running `pdftotext` instead of trusting the map. Two of the six definitions I was about to write
were wrong — Clean sweep is about the rubric being fully hit, not about the rep's conduct — and
nothing downstream could have caught either. No test knows what a badge is supposed to mean.

The map is an index that reads like a specification. That is A22's shape one level down, and the
map is a document I wrote this morning.

## The un-named reliance

- **That the sheet's captions are current.** They were extracted from a PDF dated 2026-09-19. If
  the founder has since changed what Clean sweep means, this build encodes the old answer
  confidently and with tests.
- **That "every phase" means every section in the current rubric.** The caption says phase; the
  code reads `SECTIONS`. If a rubric revision adds a section, every existing Clean sweep silently
  becomes harder to have earned — the badge is derived on read, so past dates would move.
- **That a rep wants two strips.** The argument for keeping both is arithmetic and correct. The
  argument that a rep experiences a page rather than a denominator is also correct, and this build
  chose the first.
- **That `capped` is enough.** The route reports the bound was hit; nothing consumes it. A field
  nobody reads is a field that will be wrong before anyone notices.

## Residual

```json
[
  { "id": "R1-nothing-has-been-rendered-in-a-browser",
    "item": "Two milestone strips now sit on one page, the Arena's and this one, plus two leaderboards on another. Nobody has looked at either page.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T02:20:00Z",
    "outcome": "OPENED, and this is the third consecutive build to end on this sentence, which is itself the finding. The individual risk is small each time; the accumulated one is not. Four surfaces built today have never been drawn, and the specific worry is no longer 'does a component render' but 'does a rep looking at my-progress understand that two milestone strips are two systems'. That is a question about a whole page, and by now about a whole product, which no amount of further unit testing moves. It is also the item I have least ability to close and have said so four times." },

  { "id": "R2-label-both-may-be-a-rut-rather-than-a-pattern",
    "item": "Two leaderboards, named. Two milestone strips, named. The same resolution twice in one day.",
    "why_skipped": "Each instance is defensible on its own arithmetic.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T02:21:00Z",
    "outcome": "OPENED and rated lowest deliberately. The defence of each is real: the two numbers measure genuinely different things a team uses, and merging would move dates a rep has already been shown. The problem is that the defence is available EVERY time, so it does not discriminate — and the product now asks a rep to hold two scoring systems, two leaderboards and two milestone sets in their head, each correct. A21 says the user experiences a feature concept, not a module boundary; labelling respects the boundary and leaves the concept doubled. The real resolution is a founder decision about which system is THE system, and that decision has not been asked for because each individual collision looked survivable." },

  { "id": "R3-two-definitions-are-inferred-not-specified",
    "item": "Triple digits (a pitch over 100) and In the door (bonus.inside) have no caption on the sheet. Both are my reading of the badge name.",
    "why_skipped": "The sheet gives no more than the name.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T02:22:00Z",
    "outcome": "OPENED, and the reason it matters is F1: two definitions that DID have captions turned out to contradict my reading of their names. That is a two-for-two failure rate on inference against this particular sheet, which is the strongest available evidence that these two are also wrong. Both are one constant from correct and neither has any way to announce it is wrong. Worth a single founder glance more than anything else in this build." },

  { "id": "R4-a-rubric-revision-would-move-past-Clean-sweeps",
    "item": "Clean sweep is derived on read from the CURRENT sections. Adding a section retroactively un-earns it for every rep who had it.",
    "why_skipped": "Storing an earned-at would fix it and would mean a new table and a write path on every scored pitch.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T02:23:00Z",
    "outcome": "OPENED. Derive-on-read is right for every other badge here — a first pitch is a first pitch whatever the rubric becomes — and Clean sweep is the one whose CONDITION can change under it. The Arena solved the same problem by deriving from an immutable ledger (GAM-R13); the equivalent here would be recording the sweep at scoring time. Named rather than built, because it is a schema decision on a badge nobody has earned yet." },

  { "id": "R5-capped-is-returned-and-nothing-reads-it",
    "item": "The milestones route reports whether the 900-row bound was hit. No caller consumes it, and the leaderboard route does not report it at all.",
    "why_skipped": "Surfacing it needs a decision about what a rep should be told when their own history is truncated.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T02:24:00Z",
    "outcome": "OPENED. A field nobody reads will be wrong before anyone notices — it has no test consuming it downstream and no surface that would show a regression. The asymmetry is worse than either state: two routes over the same bounded read, one reporting the bound and one silent. Recorded on the leaderboard's residual as R3 and here as R5, which is two records of one gap and no fix." },

  { "id": "R6-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the thirteenth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T02:25:00Z",
    "outcome": "OPENED, and this build is the argument for clearing it. Extracting one PDF's captions changed two definitions that were about to ship wrong. The instruction image is the one asset in this workstream that cannot be opened, and thirteen builds of resolutions now rest partly on a description that was inferred — exactly the inference this build just proved unreliable twice in six attempts." }
]
```
