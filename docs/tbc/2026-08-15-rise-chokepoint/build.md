# BUILD - rise-chokepoint

### Rise — the single entrance primitive

files: `src/components/landing/wow/Rise.tsx`

write-path: exists — authored as a named component whose API accepts only a **translation distance**
(`y`, `x`, `delay`). There is deliberately **no opacity prop**, so an author cannot express a
fade-from-nothing through it. A human adding an entrance edits the call site; changing what an
entrance is *allowed to animate* requires editing this file, with the rationale comment in front of them.

read-path: exists — imported by `WowSections.tsx` and `WowDifferentiator.tsx`; the page renders
through all nine sections in a 598,906-byte capture at 900×4300.

### The refactor onto it

files: `WowSections.tsx`, `WowDifferentiator.tsx`, `WowDifferentiator.module.css`

write-path: exists — the local `Rise` copy deleted from `WowSections`; the differentiator's two
bespoke `motion` entrances replaced; its `framer-motion` import and now-unused `useReducedMotion`
removed.

read-path: exists — differentiator re-captured after the restructure: both panels, the evidence
chips, the gate note and the divider all render correctly.

### The positioning fix H1 predicted

files: `WowDifferentiator.module.css`

write-path: exists — a `.frameInner` rule that fills the frame and carries `--pos`.

read-path: exists — `--pos:34%` present in the server-rendered HTML, and the section renders.

---

## Verification — commands by name

```
$ npx tsc --noEmit
TSC EXIT=0

$ curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:4321/landing-wow
HTTP 200

$ chrome --headless --window-size=900,4300 --virtual-time-budget=11000 --screenshot
598,906 bytes  - all nine sections render; differentiator intact after the restructure

$ curl -s http://localhost:4321/landing-wow | grep -oE ">30<|>3<|>0<"
>30<  >3<  >0<

$ grep -c "motion\." src/components/landing/wow/WowDifferentiator.tsx
0
```

The last two are the ones that matter. The honesty statistics **survived the refactor**, and the
differentiator now holds **zero** bespoke motion calls.

**coverage:** typecheck 1-of-1 exit 0; route 1-of-1; capture 1-of-1 inspected; SSR values 3-of-3;
bespoke-motion count 1-of-1. **not-run:** `npm run lint`, `npm run test`, the full `check` chain.

**untested:** pointer and keyboard on the modules grid; reduced-motion; layouts below 760px; every
non-Chromium engine. Also deliberately **not** converted: the hero's four hand-written motion configs
(lamp scale, halo, scroll cue, filament path-draw) — none is an entrance, so `Rise` does not apply.
That exclusion is examined rather than assumed in closure's residual.
