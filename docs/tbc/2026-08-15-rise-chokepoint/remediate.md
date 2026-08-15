# REMEDIATE - rise-chokepoint

### F1 — positioning context moved by the wrapper

closes: F1
disposition: FIXED
what changed: a `.frameInner` layer now fills the frame and carries `--pos`, so `.before` and `.after`
position against it and it against `.frame`. One CSS rule, with a comment stating why it exists so the
next author does not delete it as a redundant div.
clause: §1.5.1 layer 2, A38
gate-or-promise: PROMISE, and the hole is named. There is no precise detector for "a wrapper changed
an ancestor that some descendant depended on" without a layout engine to diff against, and this repo
has no visual-regression tooling. Declining rather than shipping a check that cannot be kept true.
What exists instead: the rule carries its rationale inline, and this record states that a green
typecheck is not evidence for this class of change.
risk introduced: one extra DOM node per differentiator instance. Negligible.

---

## Re-verification after the fix

```
$ npx tsc --noEmit
TSC EXIT=0

$ chrome --headless --window-size=900,4300 --virtual-time-budget=11000 --screenshot
598,906 bytes  - differentiator renders: both panels, evidence chips, gate note, divider

$ curl -s http://localhost:4321/landing-wow | grep -oE "\-\-pos:[0-9]+%"
--pos:34%

$ grep -c "motion\." src/components/landing/wow/WowDifferentiator.tsx
0
```

**coverage:** typecheck 1-of-1 exit 0; capture 1-of-1 inspected; custom property confirmed in SSR;
bespoke-motion count confirmed zero. **untested:** pointer, keyboard, reduced-motion, sub-760px,
non-Chromium.
