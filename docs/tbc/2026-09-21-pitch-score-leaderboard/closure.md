# CLOSURE — one word, two boards, both now named

## What shipped

The Pitch Score competition board: a pure ranking module, a route that answers managers and reps
differently, a surface with three states, and a scoreboard page that now carries both boards with
each saying what it ranks. R3 of the two-systems map is closed.

## What this build got right, and it was not the code

Asking **who may see this** before asking how to query it. That question surfaced migration 0252's
select policy, which meant a rep reading the board through their own client would have received a
board containing only themselves, ranked first. It does not look broken. It looks like a rep who is
winning.

The second: noticing there were two authorities. `SalesCoach-KPI-System.md` and the rubric sheet
disagree, both are in the tree, and neither is weaker. The available failure was not writing wrong
code — it was reading whichever document came to hand and never learning the other existed.

## The un-named reliance

- **That `aggregatePitches` is the same authority the rep's own board uses.** The team board and
  the individual board agree only because both call it. Nothing asserts that they agree; if the rep
  board ever computed its own totals, the two would drift and each would look right alone.
- **That a rep knowing their rank is materially different from browsing the field.** The whole
  access split rests on it. It is a judgement about people, not a property of the code, and the KPI
  document's author may not agree with it.
- **That 900 rows is enough.** `readPitchPeriod` caps there because PostgREST tops out at 1000. A
  company recording more than 900 pitches in a period is ranked on a truncated set, silently.
- **That `repId` is populated.** Optional on the type, so a caller that forgets it produces an empty
  board rather than a type error. The drop-rather-than-pool rule makes that safe and also makes it
  silent.

## Residual

```json
[
  { "id": "R1-nothing-has-been-rendered-in-a-browser",
    "item": "Three new surfaces — the rep standing card, the manager list, and a scoreboard page now carrying two boards — covered only by jsdom render tests. Nobody has looked at the page.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T23:50:00Z",
    "outcome": "OPENED because it ranks highest, and it does not survive intact. Every test here asserts TEXT and ARIA, and not one asserts anything a person would call appearance — which is the same gap named in the previous build and now compounded, because this page stacks two boards that look alike and rank differently. Concretely: the Pitch Score rows and the Scoreboard rows both render as bordered rows with a number on the right, separated only by a heading and a rule. The single most likely real defect in this build is that a manager glances at the page and reads one board as a continuation of the other. That is a layout judgement no assertion in this suite can make." },

  { "id": "R2-the-access-split-is-a-concession-the-founder-has-not-ruled-on",
    "item": "SalesCoach-KPI-System.md calls it non-negotiable that cross-agent ranking is manager-only and never how results are framed to the agent. Telling a rep they are 3rd of 9 is cross-agent ranking reaching the rep, in reduced form.",
    "why_skipped": "The founder directed the remaining items be finished rather than asked about. Recorded as section L rather than decided silently.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T23:51:00Z",
    "outcome": "OPENED, and it is the decision in this build most likely to be wrong. The KPI document does not hedge — it says non-negotiable and gives the reason, that ranking turns a growth tool into a stress machine. My split is defensible and it is still my judgement overriding an explicit clause, reduced in degree rather than honoured. If the founder reads one thing from this build it should be section L. The cheap reversal, if they want it: drop the standing card for non-managers, which is a single branch already isolated behind managerView." },

  { "id": "R3-the-900-row-cap-is-silent",
    "item": "readPitchPeriod caps at 900 because PostgREST tops out at 1000. A period with more pitches is ranked on a truncated set and nothing says so.",
    "why_skipped": "No team in this product is near 900 pitches in a week today.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T23:52:00Z",
    "outcome": "OPENED. Two things make it worse than it sounds. It bites first on ALL TIME, not on a week — the period a manager is most likely to treat as authoritative. And it bites hardest on the busiest team, which is the one most invested in the board. The read already knows when it hit the cap (rows.length === limit); reporting it would cost one field and was not done. This is the same class as skippedPreVerdict, which IS reported — an inconsistency within one response shape." },

  { "id": "R4-skippedPreVerdict-is-reported-but-not-attributed",
    "item": "The board says four older pitches were left out. It does not say whose, so a rep whose four pre-verdict pitches were dropped sees a lower total with no per-rep explanation.",
    "why_skipped": "Per-rep attribution needs the skipped rows carried through the read rather than counted and discarded.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T23:53:00Z",
    "outcome": "OPENED. It interacts badly with the override feature shipped earlier today: a rep who disputes their standing, and is right, may be right for THIS reason — and neither the manager nor the rep can see it from the board. The override path would then correct an item on a pitch when the real cause was a pitch that never entered the total." },

  { "id": "R5-the-two-boards-are-not-reconciled-only-labelled",
    "item": "A rep can be first on activity points and fourth on Pitch Score. Both are on one page, each says what it ranks, and nothing explains the gap between them.",
    "why_skipped": "Reconciling them means deciding which is THE board, which is a founder call about what the team competes on.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T23:54:00Z",
    "outcome": "OPENED. Labelling is a real improvement over one word meaning two things, and it is not a fix — A21's point is that a user experiences a feature concept rather than a module boundary, and two boards on one page is still two orderings of the same people. The remaining collisions are the milestone strip and the prize: if a prize is awarded on Pitch Score while milestones fire on gamification points, the labelling stops being enough." },

  { "id": "R6-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the eleventh build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T23:55:00Z",
    "outcome": "OPENED, unchanged. This build is specified by the rubric PDF and the KPI document, both readable, so it does not depend on the image. Eleven builds is past the point where carrying it again is reasonable; it should be re-sent in another format." }
]
```
