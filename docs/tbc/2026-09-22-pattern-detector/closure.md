# CLOSURE — the images opened

## What shipped

Pattern Interrupt, end to end: two tables, a detector, a status resolver that is the single author
of the C8 ruling, a read layer, a route and the boards' two-column screen. A rep or a manager who
opens it now sees real patterns with real statuses, or an honest reason why they do not.

And three corrections to surfaces shipped earlier today, once the reference boards were actually
looked at: the sidebar rebuilt to what the boards draw, the Breakdown board cut from four callouts
to the one it has, and Training's misclassification as a rep-only surface undone by the ruling that
followed.

## The thing that actually happened today

**The two JPEGs opened.** They had been carried as a residual for twenty-two builds under "rejected
by the API; cannot be displayed", and the honest reading of that is not that the API changed — it
is that nobody tried again. One of them is the four rep boards. The other is a screenshot of the
live Training page, which is how I found that I had marked a manager's team-brief generator
`repOnly` an hour earlier.

Everything else in this build follows from that. Four rules I had reconstructed from real, adjacent,
correctly-cited sources — 0252's deferral note, C4, B4, C8 — were wrong against the specification
that was in the same folder the whole time. Not carelessly wrong: plausibly wrong, each one, in the
way that only reading the source can catch. That is §5 in its least comfortable form, because every
citation in the previous build's record was genuine.

The Improving rule is the sharpest case. I had "miss rate since coaching versus the rate frozen at
detection" — defensible, tested, mutation-clean. The guide says first-5 versus last-5, and the Rep
progress board prints those two numbers on screen in a column headed MISSES THEN → NOW. My version
was not merely different; it computed something no screen displays.

## What this build got right, and it was not the code

Stopping when the gate said stop, three times, and each refusal was correct:

- `rls:audit` refused six undocumented write omissions. They were deliberate and the audit could
  not tell — which is the whole point of the allowlist.
- `invariant:audit` found a duplicate table named `if`. That one was the gate being *wrong*, and
  the right response was to fix the gate rather than reword my comment to get past it.
- `reachability:audit` refused the detector because nothing consumed it. The logic was finished
  and mutation-clean and committing there would have felt like shipping a feature. A31 exists for
  exactly that feeling.

And treating a surviving mutant as a question rather than a nuisance. S2 turned out to be genuinely
equivalent, which is a finding about the guide's rule — its second condition is implied by its
first — and it is now proved by exhaustion rather than asserted.

## The un-named reliance

- **That the boards are the specification.** They are mockups with sample data, and the guide says
  so. Where a board and the guide's prose differ, I took the board; nobody said to.
- **That "clean" means "not missed".** It makes the guide's own second Improving condition dead,
  and the board's word is "Done right". Left as it is, named twice, unanswered.
- **That detection will be run.** Nothing calls `detectPattern` on a schedule or after a score yet.
  The board reads patterns; nothing writes them. This is the largest gap and it is R1.
- **That a rep-scoped read is the right default.** A manager opening the page gets their own
  patterns, not the team's — correct for a rep, and not what the manager board draws.
- **That the screen is legible.** Fourteenth consecutive build with nothing rendered.

## Residual

```json
[
  { "id": "R1-nothing-writes-a-pattern-yet",
    "item": "detectPattern and the tables exist; no caller runs detection. The guide says 'Run detection every time a pitch is scored', and the pitch-score route does not.",
    "why_skipped": "The read path had to exist first or detection would write rows nothing could display — and the gate would have refused that too, correctly.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T05:20:00+08:00",
    "outcome": "OPENED, and it is the top of the queue. Today the board will always say 'No patterns right now' with the reason 'nothing has been missed in 3 or more of your last 10 pitches' — which is a CLAIM, and it is currently unearned, because nothing has looked. The empty state distinguishes scored-from-unscored, so a rep with no pitches is told the truth; a rep WITH scored pitches is told a finding that no detector produced. That is the confident-zero this codebase has an invariant against, reintroduced one layer up, and it is the single most important thing to close next." },

  { "id": "R2-the-manager-board-shows-one-rep",
    "item": "The manager Patterns board draws rep chips (Humza Khan 3 · Anthony A. 3 · …) summing to the ACTIVE PATTERNS count, and a team-wide banner across five reps. The route defaults to the caller's own patterns.",
    "why_skipped": "Team scope needs a rep roster read and the chips need per-rep counts; the rep view is the same screen limited, so building the limited one first is the guide's own framing.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T05:21:00+08:00",
    "outcome": "OPENED. The consequence is specific and slightly absurd: a manager opening Pattern Interrupt today sees THEIR OWN patterns, and a manager who does not pitch sees an empty board on a page built for them. `teamWidePatterns()` is written and tested and will always return [] until the read is team-scoped, which means a function with full coverage is doing nothing — the shape A31 is about, caught in advance this time rather than by the gate." },

  { "id": "R3-three-destinations-are-now-unlinked",
    "item": "Training, Team and One Liners have no nav entry for anyone after the ruling. Training is the live team-brief generator shown in the founder's own screenshot.",
    "why_skipped": "The ruling was 'follow the boards literally', and the boards show neither.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T05:22:00+08:00",
    "outcome": "OPENED, and applied deliberately rather than softened. The guide's replacement route for the brief is Coach Assessment's 'What the team needs to work on' card — 'the existing training brief, reshaped into three priority cards' — which is Step 3 and is NOT BUILT. So there is a window in which a manager cannot reach the brief at all except by URL. Flagged in the founder-facing report in the same breath as the change, because a ruling followed into a dead end is still a dead end." },

  { "id": "R4-clean-may-mean-done-right",
    "item": "The Improving rule's second condition is redundant under 'clean = not missed' and load-bearing under 'clean = done right'. The board's legend and PATH TO FIXED both say 'Done right'.",
    "why_skipped": "It is the B4 question — whether a Partial counts — and that is the founder's open decision, listed on page 8 of the guide.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T05:23:00+08:00",
    "outcome": "OPENED. The live consequence: a rep can clear a pattern with five consecutive Partials without ever landing the point, because `cleanStreak` uses !isMiss and a Partial is not a miss. That is a real outcome a manager would dispute, and it follows from a default nobody chose — B4 set the DETECTION predicate and said nothing about the FIX predicate. Two readings, one constant, and the constant is `missedOnly`." },

  { "id": "R5-no-pattern-has-ever-been-read-from-a-real-table",
    "item": "Every test fixture is synthetic. 0258 applied and re-applied against real Postgres, but no row has been inserted and read back through RLS.",
    "why_skipped": "No seeded environment with scored pitches across two reps.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T05:24:00+08:00",
    "outcome": "OPENED. The seam most likely to be wrong is `readApplicableGrades`'s embedded join: PostgREST returns a to-one embed as an object and a to-many as an array, and the code handles both because I could not determine which this FK produces without running it. That is a coin-flip written as defensive code, and it is the kind that works in one shape and silently yields zero grades in the other — which would render every pattern as 'new, 0 of 5' with no error anywhere." },

  { "id": "R6-fourteen-builds-and-nothing-rendered",
    "item": "The two-column board, the dot strip, the status pills and the rebuilt sidebar have all been written and none of them has been seen.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T05:25:00+08:00",
    "outcome": "OPENED, and the day's lesson applies to it directly. Twenty-two builds said an image could not be opened and it opened on the first attempt in weeks. The parallel is not exact — there is genuinely no browser here — but the reasoning that kept the image closed was the same reasoning that keeps this residual comfortable: it was true once and nobody retested it." }
]
```

---

## Residual follow-up, same session (commit `ca822fb7`)

Appended rather than edited above — the entries were true when written and the record of what was
open at closure is worth more than a tidy list (§3.1).

**R1 — nothing writes a pattern yet: CLOSED.** `runDetection` runs from the pitch-score route after
`storePitchScore`. This was the right one to take first: it was the only residual that made a
SCREEN dishonest rather than incomplete, because "no patterns right now" is a finding and nothing
had looked.

**R4 — clean may mean done right: CLOSED BY RULING.** Missed opens, Hit clears. The consequence
named in R4 — a rep clearing a pattern with five Partials without ever landing the point — is now
impossible, and the guide's previously-dead "at least one clean pitch" term is the line that makes
it so. Mutation S2 went from SURVIVED to CAUGHT with no test change, which is the cleanest evidence
available that the ruling altered behaviour rather than wording.

**R5 gained a sibling and it is worth naming.** R5 said no pattern has ever been read from a real
table. Nothing has ever been WRITTEN to one either — `runDetection` is tested entirely against a
Supabase double, so the upsert's `onConflict` string, the partial index it relies on, and the
embedded-join shape in `readApplicableGrades` have all been reasoned about and none has been run.
The double returns whatever the code asks it for, which is exactly the failure mode of a double.

**R2, R3 and R6 remain open, unchanged.** The manager view still shows one rep; Training, Team and
One Liners still have no nav entry; and fifteen builds have now shipped without a rendered surface.
