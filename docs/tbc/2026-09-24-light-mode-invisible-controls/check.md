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
