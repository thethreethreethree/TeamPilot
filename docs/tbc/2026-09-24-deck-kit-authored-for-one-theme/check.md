# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

```
$ npm run visual
  38 image(s) in artifacts/visual/
exit 0
```

## The verification the founder's option required

"Fix the kit, verify every capture." 38 images, every one opened.

The method was not eyeballing 38 pictures and declaring them fine. It was:

1. Shoot every capture with the change in. Save.
2. `git stash` the two source files, shoot every capture again — a true BEFORE, taken with the same
   harness on the same machine minutes apart. Save. `git stash pop`.
3. Hash both sets.

**22 of 38 were byte-identical.** That is strong evidence of no regression, and it is evidence a
human eye could not produce.

Then the instrument was checked, because a comparison is only worth what the instrument is worth:
shoot twice with NO code change at all. **7 of 38 differed** — spinners mid-rotation, an animated
count-up, today's date in a generated-on line. So:

- byte-identity IS evidence of no change;
- byte-DIFFERENCE is NOT evidence of change.

Every file in the differing set was opened and compared to its pair by eye. That is 16 images:
8 roleplay (the intended change), 7 known-non-deterministic, and `pitch-performance-failed.light`,
whose error card gained the border it was missing on cream.

## Findings

### The Sales Coach deck kit is authored for a fixed-dark ground

class: a shared UI primitive whose quiet-container vocabulary is white-at-low-alpha
sweep: `grep -nE "white/|black/" src/components/sales-coach/ui/deck.tsx` → 5 sites, now 0
severity: high

**[OBSERVED]** On cream, the roleplay review renders four `<DeckCard>`s as borderless text with
no dividers; in dark the same DOM is four bordered cards. The review screen contains no page-local
`white/N`.

**[OBSERVED]** 6 files import the kit; 22 `<DeckCard>`, 7 `<DeckGhostButton>`.

**[OBSERVED]** `strategy/page.tsx` — the thirteenth surface, still unrendered — contains zero
`white/N` and four `<DeckCard>`.

High because of what it says about the eleven surfaces already signed off: the page-level fixes
shipped today were instances. This is the producer. `sales-coach/page.tsx:520` is a bare
`<DeckCard>` on the home screen I "fixed" this morning by replacing its hand-rolled divs.

### Theme-following text inside a fixed-dark island

class: a `text-primary`/`text-secondary` token inside a container that is dark in BOTH themes
sweep: `grep -rnE "bg-black/(\[[0-9.]+\]|[0-9]+)" src --include=*.tsx | grep -E "text-(primary|secondary)"` → 11 sites, 5 files, every one an input or textarea
severity: high

**[OBSERVED]** The roleplay composer sits on `bg-brand-shell` (`#0B1620`, fixed). With a sentence
typed in, the light capture shows it near-black on near-black; the dark capture shows it white.
It is the only input on the page.

**[OBSERVED]** The other 10 sites of the recipe sit on `bg-base`, where `bg-black/30` resolves to a
mid-grey box — ugly on cream, not illegible. **The severity of this class is set by the GROUND, not
by the recipe**, so the sweep's 11 hits are not 11 defects. 9 of them are outside this build's
scope and are in the residual.

### Unlit dial ticks invisible on cream

class: white-at-low-opacity as an SVG stroke on a theme-following surface
sweep: `grep -nE "stroke-white/" src/components/sales-coach/doorlog/DoorDial.tsx`
severity: medium

**[OBSERVED]** On cream, "3 of 80" rendered as the number with one ember tick below it and no ring.
In dark, a full ring of grey ticks with one lit. This is the rep's primary screen and the surface
the founder personally reported broken this morning.

### A count-up clamped at one end

class: easeOutCubic progress clamped above 1 but not below 0
sweep: `grep -rn "requestAnimationFrame" src --include=*.tsx | grep -v __tests__` → 3 easing loops, all three affected
severity: low

**[OBSERVED]** Under jsdom the Progress gauge rendered `-6750` in the DOM (read out of the capture
JSON, not inferred from the picture) while the arc sat at 74%.

**[INFERRED]** In a real browser the magnitude is bounded to roughly one frame at `-1`, because
`performance.now()` and the rAF timestamp share a time origin there and can differ only by the
frame's own processing offset. **The -6750 is a jsdom artifact. Reporting it as a live 100×-scale
bug would have been the second time today I nearly handed the founder a phantom of that shape.**
The missing clamp is real; its blast radius is not what the picture suggested. Two of the three
copies are on the public marketing site.

## PHANTOMS — sixth, seventh and eighth of the session

- **`agg.counted` crash.** My catch-all `{}` served `pitch-score/breakdown`. The paragraph
  explaining that exact trap was written this morning and sits **directly above** the line that
  did it.
- **`data?.kpi.doorsKnocked` crash.** Same catch-all. Same capture file.
- **`-6750`.** Above.

## What this does not prove

**`strategy/page.tsx` (One Liners) has still not been rendered.** It is a confirmed member of this
class by inheritance and it is the thirteenth surface.

**The kit's `glow` branch and `DeckMeter` were never photographed.** No capture in the set renders
a glowing card or a meter, so both are fixed by reading rather than by seeing.
