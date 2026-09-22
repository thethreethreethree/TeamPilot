# CLOSURE — Rep progress

## What is true now

All five projects of the 2026-09-19 coaching build are built, and every named gap inside them is
either closed or written on the screen where a user would otherwise assume it worked.

This tab is the one that turns Pattern Interrupt from a list into a workflow. Before it, a manager
could see that a rep had three open patterns; they could not see that one had been coached nine
days ago and had not moved, that another was at two clean pitches in a row, and that the third had
never been mentioned to anyone. Those three facts point at three different conversations.

## What I am relying on that nobody named

1. **`rep_reviewed` is a real event kind that nothing writes.** This was hypothesis 4 in
   `think.md` and it is still true. The "Rep reviewed" tile and column render correctly and will
   read `0/N` forever, because no surface lets a rep acknowledge a coached pattern. **That is the
   A31 seam of this build**, and unlike the last one I have not closed it in the same session. The
   denominator is at least honest — coached patterns, not all of them — so the tile says "0 of 2
   acknowledged" rather than implying the rep ignored something nobody sent.

2. **No `pattern_events` row has ever been written by a human.** `coached`, `drill_assigned` and
   `fixed` are all valid kinds with no writer. The manager actions on the Patterns tab — Mark as
   coached, Assign Role Play drill, Add note — are on the mockup and not in the product. So the
   timeline will currently draw bars with **no markers on them**, and the table's LAST COACHING
   column will read "Not coached yet" for every pattern in existence. Every derivation handles it;
   the board will simply look emptier than the render until those actions exist. Named here rather
   than discovered on Monday.

3. **"Fixed this month" uses UTC months.** A team in UTC+8 fixing something at 7am on the first of
   the month sees it counted in the previous month for the rest of that day. Small, real, and not
   worth a timezone column until someone has a timezone.

4. **The timeline window is a rolling 30 days**, not a calendar month. The render says
   "Pattern timeline · September"; mine says "Aug 23 – today". Rolling is more useful on the 2nd of
   a month and is a deliberate divergence from the board, not an oversight.

5. **`attentionReason` is showable to a rep and is not yet shown to one.** The sentence exists
   precisely so it can be, and the rep-facing Patterns tab does not render it. A10 is satisfied in
   the design and not in the deployment.

## Not built, and said on the screen

- **"Schedule check-in"** is disabled with the reason beneath it. It creates no calendar event.
- **The three manager actions** that would write `pattern_events` (see above).
- **Rude-or-dismissive flags** in Coach Assessment's "Needs your attention" — still says so.
- **The rep's Grant/Decline** for a team-example request shipped earlier today, so that one is off
  the list.

## A position from think.md I did not implement, and why

`think.md` said the check-in agenda "goes through the same control gate as the rest of the
guidance layer, consumed as a verdict". **It does not, and on reflection it should not.**

§3.4's control gate exists so month 1 captures an honest baseline of a team operating as
themselves, with the AI guidance layer off. The test it encodes is in its own first line: *a
system that behaved identically for every customer on install would be claiming understanding it
cannot have.*

The agenda cannot exist on install. It requires open patterns, which require ten scored applicable
pitches with three misses among them, and every sentence it produces is a restatement of that
team's own event log. There is no model call, no prior, and nothing that would read the same for
two different companies.

Gating it would also be **incoherent with the board it sits on.** The status pills, the stalled
alert and the "then → now" column are the same class of derivation and are not gated; suppressing
only the card that phrases them as verbs would leave a manager reading "Stalled: coached 8 days
ago with no improvement" above an empty agenda, which communicates nothing except that something
is switched off.

So the think.md line was a reflex — the word "advice" reaching for the guidance gate — rather than
a reading of what §3.4 protects. Recorded as a reversal rather than dropped, because the
prediction is on the record and a build that silently does not do what its think.md promised is
the failure the TBC record exists to catch.

## The mistake this build corrected, which was mine and was about evidence

`EVIDENCE.md` recorded this board as showing C8 — the rep list and the panel disagreeing about
"open". Opening the source at full resolution showed the numbers agree: a partition and a total.

**C8 itself was never wrong.** `LOGIC-AND-CONTRADICTIONS.md` states it precisely — "both total
correctly in their own frame" — and the finding is about one word carrying two senses. What was
wrong was my restatement of it, made from a small image, which turned a subtle vocabulary defect
into an accusation of bad arithmetic against the founder's own work. It had reached three
documents.

The rule it broke is R2 and it is not "look harder": **a summary never discharges its source.**
Both summaries were available and neither was re-read. The structural version of the lesson — the
one worth keeping — is that a claim about someone else's work should be re-derived from the
source before it is repeated, and the cheapest moment to do that is when you are about to build
from it.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build.

One source was opened and described at full resolution before any code was written:
`Pattern Interrupt  manager Rep progress (web).pdf` — 1 page, 1,649,160 B, opened 2026-09-22.

Still unopened across this build cycle: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser
— seventeenth consecutive build shipped from jsdom.
