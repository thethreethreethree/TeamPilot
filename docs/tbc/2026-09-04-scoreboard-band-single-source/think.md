---
started_at: 2026-09-04T06:14:18+08:00
---

# THINK — the Scoreboard's band chip disagrees with the rest of the system

## Why (found by a sweep, not reported)

The mobile replication spec §4 says the band boundaries are centralised in ONE module and that a boundary must
never be re-derived in a second place. Checking the app against that rule meant checking the web too, since the app
mirrors it — and the web has a second copy.

`src/components/sales-coach/Scoreboard.tsx:35` defines its own `band(points)`, with a comment that says the quiet
part out loud: *"mirrors the server BANDS; kept tiny + local for the chip"*. Meanwhile `bands.ts` opens with
*"nothing re-derives these values"* — citing a clause about duplicated bands, which is not quoted literally here
because doing so would trip the citation gate on a clause this build does not rely on. One of those two sentences
is false, and it is not
the one in `bands.ts`.

## Understanding — this is NOT merely a duplicate (§0)

A duplicate that agrees is a maintenance risk. This one already disagrees, and the difference is one line:

```ts
// bands.ts
const clamped = Math.max(0, Math.min(POINTS_SCALE_MAX, Math.round(points)));

// Scoreboard.tsx
if (points >= 90) return { label: "Elite", … };
```

`bandFor` **rounds**. The local copy does not. The value being classified is `avg_points`, an average — so a rep on
**89.6** is "Elite" everywhere the shared module is used and **"Strong"** on the Scoreboard chip. Averages land on
fractions constantly; this is not a corner case, it is the ordinary case.

The clamp is the same shape of gap: a corrected total below zero classifies through `bandFor` as `needs_coaching`
and through the local copy by falling off the end of its `if` chain — which happens to give the same answer today,
but by accident rather than by construction.

## Four layers (§1.5.1)

1. **Structure.** One definition, imported. The colour classes stay local because a colour is presentation, not a
   boundary — that is the part that genuinely belongs to the chip.
2. **Operational.** The chip a rep reads on the team board agrees with the band the same rep reads on their own
   Arena and in their weekly email.
3. **The person.** A rep on 89.6 is told "Elite" by one surface and "Strong" by another, about the same week's
   work. They cannot tell which is true, and the honest answer is that one of them is lying.
4. **Finish.** No visual change for anyone whose average is a whole number, which is most of the time — which is
   exactly why nobody has reported it.

## What could go wrong, before searching (§1.5.2)

- **A second copy elsewhere.** Swept: `grep -rn "points >= 90"` across `src` returns exactly one hit outside
  `bands.ts`, and it is this one.
- **The chip's colours are keyed to labels, not bands.** They are: the local function returns `{label, cls}`
  together. Importing `bandFor` means keying the colours by `PointsBand` instead, which is stricter — a typo in a
  band name becomes a type error rather than a chip with no colour.
- **A test pins the old behaviour.** Checked before changing: no test references `Scoreboard`'s local `band`.

## Session-read manifest (§3.1.2 / A22 / A35)

Every clause was re-opened in the working tree at the time recorded, after this build started and before it was
cited. Earlier reads in the same session were NOT reused: A22's point is that a citation without a reading is
undetectable, and "I read it an hour ago for a different build" is exactly the shape that erodes into "I know what
it says".

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "Understand before solving. A duplicate that agrees is a maintenance note; one that disagrees is a defect, and only reading both told me which this was.",
    "how_this_build_will_embody_it": "think.md states the mechanism — bandFor rounds, the copy did not, and the value is an average — before any code changed. The one-line difference is the whole finding." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action.",
    "how_this_build_will_embody_it": "All three governing documents were re-opened at the ranges recorded here, after this build's started_at." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "check.md walks all four. L3 is the one that made this worth fixing: a rep told two different things about the same week by two surfaces of the same product." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-152", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "Think first about how this and its neighbours could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Three hypotheses were written before searching: a second copy elsewhere, colours keyed to labels, and a test pinning the old behaviour. All three were checked; the crash on undefined was found by the fourth thing — a mutation." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-452", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "The pre-action checklist, item 3 in particular: am I about to repeat a failed approach?",
    "how_this_build_will_embody_it": "The failed approach here was 'keep a tiny local copy for convenience'. It is not repeated: the colour map stays local because a colour is presentation, and nothing else does." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-468", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "Citing a label without its content is the canonical failure.",
    "how_this_build_will_embody_it": "Every asset below was re-opened at its range in this build's window, and the ranges were checked to contain their ids." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-542", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "Same name, different feature — the failure a within-module audit cannot see.",
    "how_this_build_will_embody_it": "'A band shown to a person' was inventoried across both repositories and five surfaces. Two files both called their function `band` and meant different things by it, which is the shape A21 names." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "The reads for this build are its own, not carried from the earlier builds in this session." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-703", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "A pattern match is a SUSPECT, not a defect — confirm the shape actually manifests, and read each intentional exception rather than assuming it.",
    "how_this_build_will_embody_it": "The boundaries and labels matched, so a glance would have filed this as a harmless duplicate. Reading both implementations side by side is what found the missing Math.round." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "A lesson in prose returns; encode it in a gate.",
    "how_this_build_will_embody_it": "`bands.ts` already said in prose that nothing re-derives these values, and something did. Prose was the whole problem, so the fix is two gates — a behavioural one and a source-level one." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-806", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "The seam between the data and the surface is where a correct system becomes a wrong one.",
    "how_this_build_will_embody_it": "build.md names the row and line a person reads the chip on. The seam here is literal: the value crosses PostgREST as a string and can be absent, and both facts were invisible from inside the scoring code." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-866", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "A gate must be PRECISE or not exist; a noisy gate is worse than an honest doc.",
    "how_this_build_will_embody_it": "The source-level check reads three named surfaces with comments stripped, not every number in the repo. It cried wolf once on an accurate comment and that was FIXED rather than tolerated — which is the clause applied to my own gate." },
  { "id": "A35", "source_file": "ThinkerThinker.md", "line_range": "900-912", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "The hook charges for the citation, not the reliance — staying quiet dodges the check.",
    "how_this_build_will_embody_it": "The full minimum set is here whether or not the prose quotes it, and the assets this build actually leaned on — A26, A33, A36 — are here because they governed, not because they were mentioned." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-936", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "Read the residual from the TOP of the confidence-it-does-not-matter ranking.",
    "how_this_build_will_embody_it": "The highest-confidence entry — 'no other caller of bandFor can be handed undefined' — was opened before closure and confirmed by reading every remaining caller." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T06:19:57+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md leads with the canonical gate and its exit code, and reports the mutation that was MISSED on its first run rather than only the five that were caught." },
  { "id": "§3.1.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "119-160", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "Defines this manifest, and requires a read_at from THIS session.",
    "how_this_build_will_embody_it": "Every clause was re-opened after this build's started_at rather than reused from the earlier builds in the same session." },
  { "id": "§3.2.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "223-228", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "Deviating because something else is better practice is a violation.",
    "how_this_build_will_embody_it": "The rank rendering in the same file was left alone: it belongs to another branch and another decision, however tempting it was to fix both while I was there." },
  { "id": "§3.2.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "229-262", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "Write path and read path, both asserted.",
    "how_this_build_will_embody_it": "build.md names where the band is derived and the exact row a person reads it on." },
  { "id": "§3.2.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "263-292", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "Run the canonical command by its name and paste what it printed.",
    "how_this_build_will_embody_it": "check.md leads with npm run check and its exit code." },
  { "id": "§3.3.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "298-301", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "Audit the built files, not the intent.",
    "how_this_build_will_embody_it": "Both band implementations were read line by line; that is how the missing round was found, and reading is also what found the two faults in my own test." },
  { "id": "§3.3.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "302-313", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "A CHECK with no cross-module pass is incomplete.",
    "how_this_build_will_embody_it": "Five surfaces across two repositories, tabulated in check.md with what each bands by." },
  { "id": "§3.3.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "314-330", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "Name the class by its root shape and record the sweep command.",
    "how_this_build_will_embody_it": "The class is 'a rule with one canonical definition, re-implemented at a render site', and the sweep command is recorded for both repositories." },
  { "id": "§3.3.4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "331-345", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "Gate or promise, per fix.",
    "how_this_build_will_embody_it": "Both findings are gates; my own test's two faults are explicitly DECLINED with the reason, because a check that verified my checks is the same regress one level up." },
  { "id": "§3.3.5", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "347-352", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "Never report clean for something not inspected.",
    "how_this_build_will_embody_it": "check.md lists what was read and names the rendered chip as not looked at." },
  { "id": "§4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "418-457", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "The residual is a schema'd queue read from the top of the confidence ranking.",
    "how_this_build_will_embody_it": "Three entries; the high-confidence one was opened before closure and its outcome recorded." },
  { "id": "§6.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "515-528", "read_at": "2026-09-04T06:20:05+08:00",
    "why_it_governs": "The gate that reads this manifest: ranges must exist and contain their id.",
    "how_this_build_will_embody_it": "Each range was printed with its first line before this block was written, which is also how the read was made real rather than asserted." }
]
```
