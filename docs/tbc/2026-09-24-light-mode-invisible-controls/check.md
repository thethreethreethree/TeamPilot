# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

```
$ npm run check
      Tests  5509 passed | 15 skipped (5524)
CHECK_EXIT=0
```

`theme:audit` is one of that gate's twelve steps and it passes — both before and after. It has no
category for `white/N`, which is the finding below rather than a footnote to it.

## It was looked at — six captures, opened and described

| Surface | Theme | What was there |
|---|---|---|
| Macro home | dark | Two pager dots, one amber one grey. Three header controls fit. |
| Macro home | light | **ONE dot.** The inactive one gone. |
| Macro home | light, after | Two dots, amber and mid-grey. |
| Sales Coach home | light | Macro switch = a bare white circle, no track. Macro card and stat chips = floating text, no borders. |
| Sales Coach home | light, after | A pill switch with a grey track; Macro card and both chips bordered. |
| Sales Coach home | dark, after | Track is dark grey — close to the old white/15 — everything else unchanged. |

The comparison IS the method here. Neither capture alone shows a defect; the pair does.

## Findings

### `white/N` used as a theme-neutral tone

class: a colour that is a dark-mode idiom used where the ground follows the theme
sweep: a script counting `(bg|text|border|ring|divide|from|to|via)-white/N` per file, skipping lines that also name an intrinsically dark ground (`bg-brand-shell`, `bg-black`, a dark arbitrary hex)
severity: high

**[OBSERVED]** 256 uses across 47 files, plus 28 skipped as same-line dark grounds.

**[OBSERVED]** three of them are confirmed broken by render and fixed here.

**[ASSUMED]** the remaining 253 are a SUSPECT LIST, not a defect list. Several of the top files —
`CareRadialHome.tsx` (37), `RcdMobileSheet.tsx` (23), `SalesCoachShell.tsx` (16) — are
intentionally fixed-dark surfaces where `white/N` is correct, and two are already on theme-audit's
documented allowlist for exactly that reason.

The largest genuinely suspicious cluster is the schedule module — `grid` (15), `page` (12),
`import` (10), `coverage` (6), `new` (6), `timeoff` (5) — 54 uses on surfaces with no reason to be
fixed-dark. **Unverified.** Nothing in this build rendered a schedule screen.

### theme-audit has no vocabulary for this

class: a gate that answers a nearby question confidently while the real one is outside its categories
sweep: read `scripts/theme-audit.mjs` in full — its leak categories are navyNamed, hexLeak, crimsonText, goldText, paleText, inlineStyle, brandRedSameElement
severity: medium

**[OBSERVED]** none of the seven categories matches `white/N`.

**[OBSERVED]** the script's own FILE_ALLOWLIST entries describe files as having "white/10 chrome …
single-theme by design" — so the author understood `white/N` is a dark-mode idiom and encoded only
the case where it is *correct*, never the case where it is wrong.

Same shape as `writer:audit` this morning, which confirms every table has a writer and cannot ask
whether anything calls it.

## What this does not prove

**Two screens out of a module.** The Sales Coach home and the Macro home were rendered. Door Log,
Today's Metrics, Pitch Performance, Roleplay, One Liners, Sessions, Analytics, Coach Assessment,
Settings and every Pattern Interrupt screen were not.

**Nothing ran in a real browser session.** These are jsdom renders with mocked fetches,
screenshotted by headless Chrome. They catch what a surface looks like; they do not catch what it
does when a real click hits a real server.

### A raw brand scale used where the contrast-aware token exists

class: a brand colour written as a raw scale value, bypassing the mode-aware CSS variable built for it
sweep: `grep -rn "text-ember-400" src --include=*.tsx | grep -v __tests__`
severity: medium

**[OBSERVED]** 34 uses of `text-ember-400`.

**[OBSERVED]** one of them — the pitch total in `RecordingsTab` — is body text at `text-lg`, was
written by me on 2026-09-22, and renders washed out on white. Fixed.

**[ASSUMED]** the other 33 are mostly icons, `hover:` states layered on `text-brand`, or fixed-dark
demo surfaces. NOT rendered, NOT verified, and deliberately not mass-edited — the same discipline
applied to the `white/N` count in this build.

The sharp part is not the number. It is that `globals.css:120` documents the founder reporting this
exact symptom on 2026-07-24 and the fix being applied "at the root" — and two months later a new
line bypassed the root.

### Door Log renders CLEAN in light — and two of its states were not reached

class: a colour chosen against a dark ground, in a state a capture does not enter
sweep: `grep -nE "text-red-(300|400)" src/components/sales-coach/doorlog/DoorLog.tsx`
severity: medium

**[OBSERVED]** the Door Log's IDLE state is correct on cream. The KPI row, the "Ready for the next
door" empty state, and both action buttons are legible. An honest negative, and worth recording:
the `white/N` class is not universal, and six `white/N` uses in this file produced no visible
defect in the state a rep spends most of their time in.

**[INFERRED, NOT RENDERED]** two failure states carry colours picked for matte black:

- `DoorLog.tsx:494` — the send-failure banner, `text-red-300` (#FCA5A5) on `bg-red-500/10`. On
  cream that wash is nearly white and the text measures far under AA. This is the message telling a
  rep their door log did not save.
- `DoorLog.tsx:625` — `text-red-400` (#F87171) on the theme-following ground, roughly 2.5:1 on
  cream. The sentence is "The mic stopped — audio isn't recording", which is the most urgent thing
  this screen can say.

Neither is confirmed by render. I attempted the mic-stopped state three times — mocking the
recorder's `captureInterrupted`, then clicking Record Pitch — and the component's own state machine
never advanced, because the mocked `arm`/`start` do not drive it. Stopped there rather than keep
varying the same wrong identification (§2). **These stay [INFERRED] with their hex values shown,
not upgraded to observed.**

`theme-audit`'s `paleText` category covers `text-<palette>-100/200` and stops short of `300`, so
neither is flagged.

### Coach Assessment renders clean — and says one sentence twice

class: two components that each independently print the same sentence, correct alone, duplicated together
sweep: `grep -n "shown in full above" src/components/sales-coach/*.tsx`
severity: low

**[OBSERVED]** the manager dashboard — the densest surface in the module — is correct in light
mode. Four stat cards, the five-KPI activity row, the period toggle, the reps table header and
every empty state are legible and bordered. A second honest negative, and the more meaningful one
because of how much is on this screen.

**[OBSERVED]** under "Needs your attention", *"Open score disputes are shown in full above."*
appeared twice in a row: once ending `ReviewFlagQueue`'s empty-state message
(`ReviewFlagQueue.tsx:85`), then again from the board itself
(`CoachAssessmentBoard.tsx:440`), which prints it unconditionally after rendering the queue.

Both sentences are individually correct, which is why no test sees it and reading either file
alone does not either. The board's own comment three lines above the duplicate explains it is
AVOIDING duplication — "Duplicating them as a summary line would be a second count of the same
thing on one screen."

Fixed by removing the clause from the queue, whose message is about flags; disputes are not its
subject. Verified from the rendered HTML rather than the source: the string now appears once in
`coach-assessment.light.html`, where the captured screen showed it twice.
