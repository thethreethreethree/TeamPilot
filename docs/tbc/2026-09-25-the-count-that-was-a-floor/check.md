# CHECK

## Commands

```
$ npm run visual -- doorLog → 2 passed, 4 images
$ npm run check             → 5522 passed, 15 skipped, CHECK_EXIT=0
```

## It was looked at

**`door-log.light`, before** — "← Sales Coach"; a row reading **37 KNOCKED, 2 SOLD, 0 GO-BACKS,
0 NOT INT.** in which **only SOLD sits in a card** (cream fill, ember border) and the other three
are bare numbers on the page; a door glyph with **no ring**; "Ready for the next door"; a
**barely-visible white "No Answer" box**; and a solid ember "Record Pitch".

**`door-log.light`, after** — four tiles, each in a bordered white card with SOLD still accented;
the door glyph inside a bordered circle; "No Answer" a proper white button with a visible edge.

**`door-log.dark`** — four bordered tiles, the ring, and a dark "No Answer" throughout. The pair is
the finding: the design is four tiles and two buttons in both themes, and cream had one tile and
one button.

**`door-log-recording.light`, new** — a red pulsing dot beside a 0:00 timer, nine ember level dots
(their minimum height at a zero input level), and a white bordered "Stop" pill. Discreet, as the
component's comment says it must be: *"reps record at the door … not a loud full-width red button
that broadcasts recording to the prospect."*

**`door-log-recording.dark`, new** — the same, with the Stop pill a dark bordered capsule.

## Findings

### Three of four KPI tiles had no tile

class: white-alpha container, in the UNSELECTED branch of a conditional
sweep: render-tree, by pattern → `DoorLog.tsx` 11 sites, now 0
severity: high — this is the rep's core loop, used at every door

**[OBSERVED]** `t.accent ? "border-ember-400/40 bg-ember-400/[0.08]" : "border-white/10
bg-white/[0.03]"`. The accented tile is a card on both grounds; the other three are cards only on
dark.

**[OBSERVED]** I rendered this screen this morning and recorded it as clean.

Worth stating plainly: **the fourth tile having a card is what made the other three look
deliberate.** A missing container reads as a design choice when something beside it has one.

### The capture drove one state of a four-state machine

class: a capture that enters one branch and is reported as the component
sweep: `grep -nE 'state === "' DoorLog.tsx` → idle, recording, outcome, naming
severity: high, as method

**[OBSERVED]** Seven of the eleven sites were in states no capture had entered.

Sixth occurrence of the branch problem today, after After Pitch (Standard/Expert), Sessions
(three), Analytics (the ELO gauge), Training (status-driven) and Settings (two tabs).

### The mock lied about a contract, beneath a comment warning about it

class: a stub whose return type does not match the real function's
sweep: `useDoorRecorder.ts:403` — the hook's real surface
severity: medium, and entirely self-inflicted

**[OBSERVED]** `start: vi.fn()` returns undefined; `recordPitch` honours a falsy return by refusing
to enter the recording state. Every simulated click was a mic denial, which is why the state never
changed.

**[OBSERVED]** The comment two lines above, written by me this morning, warns about precisely this
for `arm`.

## THE COUNT — three wrong numbers before a right one

| run | result | why it was wrong |
|---|---|---|
| render tree, all matches | 94 | counted the `dark:` halves of my own mode-splits |
| excluding `dark:` | 82 | counted matches inside CODE COMMENTS describing replaced values |
| excluding comments | **80 across 20 files** | — |

Two of the false positives were `MacroModeToggle:47` and `MobileHomePager:80`: my own documentation
of this morning's fixes, reported as defects by my own tool.

**Third scanner today to give a wrong number before a right one**, after the wrong-namespace probe
(0 for a class of 56) and the accent-colour scan (18 for a class of 5). Each was caught the same
way, by reading the members.

## What this does not prove

**74 of the 80 remain.** Six are closed. The rest are listed in the closure by file.

**The `outcome` and `naming` states are still unrendered.** Their sites were fixed by pattern, and
`door-log-recording` covers only the third of four screens.

**The sweep covers Sales Coach only.** The same method applied to `dashboard`, `care` and the rest
would produce a number nobody has.
