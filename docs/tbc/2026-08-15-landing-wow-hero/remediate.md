# REMEDIATE — landing-wow-hero

Every finding from check.md reaches a disposition. Each fix answers **gate-or-promise** per A30.

---

### F1 — fail-closed entrance animations

closes: F1
disposition: FIXED, class-swept
what changed: every entrance in `src/components/landing/wow/` animates **transform only**.
  The headline rises line-by-line behind an `overflow: hidden` clip; the lamp scales; the halo and
  scroll cue start at a visible opacity; the `Filament` mark starts at `pathLength: 0.001` so the
  stroke exists before the draw. The `@property` radial mask was deleted outright.
clause: §1.5.1 layer 2, A30
gate-or-promise: PROMISE — and the hole is named.** There is no precise detector for "this
  element's resting state is invisible." A grep for `opacity: 0` fires on legitimate uses (a
  deliberately hidden overlay, a fade-out, the transparent range input in this very build, which is
  correct and must stay). Per A33 a check that fires on correct code is one people learn to skip, so
  I am declining the gate rather than shipping a noisy one.
  **What exists instead:** the rule is stated at the top of `WowHero.tsx` where the next author
  editing this hero will hit it, and the swept boundary (`grep -n "opacity: 0"
  src/components/landing/wow/*.tsx` → 0) is recorded here as the baseline for the next audit.
  **Honest limit:** that is exactly the prose-only defence A30 says will return, and it returned
  three times inside this one build. If it recurs, the chokepoint to build is a shared
  `<Rise>` primitive that only accepts transform props — making the defect unexpressible rather
  than detectable. Recorded as the residual's top entry.
risk introduced: transform-only entrances cannot fade, so an element that overlaps another
  during its slide will show a hard edge rather than blending. None do at present; a future
  overlapping layout must revisit this.

### F2 — static check reported as operational

closes: F2
disposition: FIXED (behavioural, this build)
what changed: every verification claim in build.md names a command that was **executed** —
  `tsc --noEmit`, `curl`, headless render — with its exit code or byte count pasted. No parse-only
  check is reported as a correctness claim anywhere in this record.
clause: A38
gate-or-promise: GATE, already in place.** `tbc:artifacts` fails any use of
  "verified"/"green"/"passing" not adjacent to a pasted command output carrying an exit code. That
  gate binds this very document, which is why coverage here is stated as n-of-n with the not-run
  list explicit.
risk introduced: none.

### F3 — clip boundary disagreeing with layout origin

closes: F3
disposition: FIXED
what changed: `.after` gains `padding-left: calc(var(--pos) + 46px)` so its content always
  begins clear of the handle; `.afterInner`'s `margin-left: auto` removed as now redundant; default
  handle position moved 38 → 34 for a better first impression.
clause: §1.5.1 layer 2
gate-or-promise: PROMISE.** A text-clipping defect at an arbitrary slider position is not
  precisely detectable without visual-regression tooling this repo does not have. The honest
  mitigation is that the padding is now expressed **in terms of `--pos` itself**, so the invariant
  holds by construction at every handle position rather than at the one I happened to screenshot —
  a chokepoint rather than a spot fix, which is A33's preferred answer when a detector is unavailable.
risk introduced: at very narrow viewports the padding could crowd the diagnosis text. The
  720px breakpoint was not tested — filed to the residual.

---

## Re-verification after the fixes

```
$ npx tsc --noEmit
TSC EXIT=0

$ chrome --headless --window-size=1400,2300 --virtual-time-budget=9000 --screenshot
446,420 bytes written
```

Both sections legible in the capture: headline, subhead, both CTAs and tagline in the hero; eyebrow,
title, lede, both comparison panels, evidence chips, the gate note and the divider in the
differentiator. No blank regions.

```
$ grep -n "opacity: 0" src/components/landing/wow/*.tsx
(0 matches — class boundary confirmed clear)
```

**coverage:** typecheck 1-of-1 exit 0; class sweep re-run and clear; visual confirmation at
1400×2300. **not-run:** lint, tests, the full `check` chain. **untested:** pointer drag, keyboard
operation, reduced-motion, sub-720px, and every non-Chromium engine.
