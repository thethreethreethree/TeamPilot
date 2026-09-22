# BUILD — Rep progress

## What was built

Project 5's second tab, and with it the last named gap in the 2026-09-19 coaching build.

| From the render | Where it landed |
|---|---|
| Five team cards (OPEN PATTERNS / FIXED THIS MONTH / STALLED / AWAITING REP REVIEW / POINTS RECOVERED) | `teamCards()` → `TeamCardRow` |
| Rep list, "NEEDS ATTENTION FIRST", pill + three-segment bar + "N fixed · N improving · N open" | `rankRepsByAttention()` → `RepList` |
| Five rep tiles, including "2/2 Coached patterns acknowledged" | `repTiles()` |
| The pink `Stalled:` / `Waiting on you:` box | `repAlerts()` |
| "Pattern timeline · September" with Ⓒ Ⓓ Ⓡ | `timeline()` → `Timeline` |
| "Where each pattern stands" (6 columns) | `verdict.comparison` → `PatternTable` |
| NEXT CHECK-IN AGENDA + Schedule check-in / Open clips | `checkInAgenda()` → `Agenda` |
| FIXED PATTERNS with pts/pitch | `FixedPatterns` |

**No migration.** The first build in this cycle that needed none — every column on this board is
derivable from `patterns`, `pattern_events` and the grades already read.

## The correction this build made to its own evidence

`EVIDENCE.md`'s line for this board called it "C8 on one page" — "1 fixed · 1 improving · 2 open"
in the rep list against "Open patterns 3" in the panel, as if the two numbers disagreed.

**They do not.** 1 improving + 2 open = 3, and the table beneath lists exactly three non-Fixed
rows. The list partitions what the panel totals.

**C8 itself stands**, and `LOGIC-AND-CONTRADICTIONS.md` had already stated it correctly — I had
not re-read that either. Its wording: *"Both total correctly in their own frame."* The finding is
that the WORD "open" carries two senses on one page, which is a real vocabulary defect the founder
ruled on. It was never a claim that a count was wrong.

So the mistake is narrower than it looked and worse for it: a precise, correctly-recorded finding
about a word, restated from a small image as a contradiction in the founder's arithmetic, and then
propagated. **A summary of a summary, twice removed from the render** — which is R2 exactly, a
summary never discharges its source. A21's lesson is about names; this is the same failure at the
level of pixels. Corrected in `EVIDENCE.md`, in `PatternInterrupt.tsx`'s header, and here.

## The one judgement this build makes, and why it is written down

Nothing in the guide defines "needs attention", and the board both **sorts** by it and **prints a
pill** for it: Needs 1:1 / Follow up / New rep / On track.

A11 says the system mirrors rather than judges, so the rule is deliberately dull and entirely
countable:

```
needs_1_1   any STALLED pattern            — coaching happened and did not take
follow_up   open ≥7 days, never coached    — nobody has tried anything yet
new_rep     patterns, none coached, none overdue
on_track    everything else
```

Each branch is a fact about rows the rep can see. None is a trait. "Two of these stalled" is a
mirror; "struggling" is a verdict, and the pill is only ever shorthand for the first.

**A10 follows.** A pill is a judgement printed beside a person's name on a screen they cannot open,
so `attentionReason` carries the same sentence in words that could be shown to the rep — and the
panel prints it in full rather than hiding it in a tooltip. A rep learning secondhand that the
product filed them under "Needs 1:1" is worse than the pill not existing.

`Stalled:` and `Waiting on you:` are kept apart for the same reason they are on the board: they
ask for different actions. Merging them would send a manager to repeat an approach that has
already failed.

## Two changes to the authorities, both to avoid a second one

**1. `verdict.comparison`.** The table prints MISSES THEN → NOW on *every* row — "3/5 → 3/5 →" on
Stalled and New, "4/5 → 1/5 ▼" on Improving. Only the Improving branch had ever put the figures
in `reason`, so any surface wanting the column for the other four statuses had to recompute it.
That is §2.2 exactly: two places deciding what "then" and "now" mean, drifting the day
`COMPARISON_WINDOW` changes. The comparison is now computed once, before the branches, and
returned as data. `null` when there is too little history, which the column renders as "—".

Direction compares **rates**, not counts. With full windows the denominators match and it makes no
difference; with a short history they do not, and 2-of-3 is worse than 3-of-5, not better.

**2. `PatternRow.events`.** The timeline draws one marker per event at its own date, and
`coachedAt` is a derived single instant. Both are kept: the resolver needs the instant, the
timeline needs the log, and deriving either from the other in each surface is the duplication the
rest of this module exists to avoid. `readPatterns` already read the events; it now hands them
down.

## What the tests found

**A crash at the wire boundary.** A fixture written without `events` took the whole tab down
through `useMemo` — `undefined.filter`. That is not only a fixture bug: these derivations run
server-side over rows this codebase just built *and* client-side over JSON, and **a browser holds
its bundle across a deploy**. A client compiled against today's shape can be handed yesterday's
response, and `events` and `comparison` are both fields that did not exist yesterday. Hardened at
every reader — `eventsOf()` in the derivation, `?? []` and a falsy check on the surface — with the
reason recorded at each.

**An agenda that could list one pattern twice.** Three sequential filters over one array, with
conditions that are disjoint in real data and not structurally. The state that produces it is a
partial write: a verdict says stalled, the coaching date is missing. "Call out the progress" and
"introduce this" about the same pattern is worse than either line alone. De-duplicated by pattern
id.

## Four-layer trace (§1.5.1)

**1 — Structure.** One pure module, no IO, no new table. `repProgress.ts` imports `PatternRow` and
`countPatterns` and nothing else.

**2 — Effectivity.** Every element of the render is present and fed by real reads. The route
returns `repProgress: null` on a rep-scoped read rather than a one-person "team" — a rep ranked
first against nobody is the flattering-but-false board the leaderboard build caught itself on.

**3 — Composition.** "Open clips" reaches the Recordings tab built this morning, where every
pattern moment is already a marker. "Schedule check-in" is **disabled and says so on the screen**,
because a live-looking button that does nothing is the worse half of an unbuilt feature.

**4 — Surface.** The two-column layout, four pills, three-segment bars, the Ⓒ Ⓓ Ⓡ legend, the
dash strip at "N of 5", the ‹ Rep 1 of 5 › pager, and the two bottom cards — all from the render.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
One source was opened and described: `Pattern Interrupt  manager Rep progress (web).pdf`
(1 page, 1,649,160 B, opened 2026-09-22 at full resolution), described in `think.md` and in the
session record before any code was written.
