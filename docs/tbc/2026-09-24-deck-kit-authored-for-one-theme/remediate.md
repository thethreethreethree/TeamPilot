# REMEDIATE

### The deck kit authored for a fixed-dark ground

gate-or-promise: gate

**The fix IS the gate.** This is the difference between this build and the three before it. On the
home, on Analytics, and on Recordings the same class was fixed instance by instance and the gate
was deferred each time. Fixing the producer means the next `<DeckCard>` anyone writes is correct
without their cooperation, which is what A30 asks of a gate — it does not depend on the author
remembering.

What remains ungated is the class OUTSIDE the kit: hand-rolled containers using `white/N` on
theme-following surfaces. `theme-audit.mjs` is still the place for that and it is still deferred,
for the fourth time, behind the render pass — but the argument has changed shape. Before today the
reason was "I cannot tell a fixed-dark surface from a theme-following one without looking." That is
still true, and the composer fix is the proof: an automated rule that replaced `white/N` with a
token would have made the composer WORSE, because there the white-alpha values are the correct
ones and the theme token is the defect. **A gate for this class has to know which ground it is
standing on, and nothing in the class name carries that.**

### Theme-following text inside a fixed-dark island

gate-or-promise: promise

Nine of the eleven sites are out of scope and named in the residual.

**The promise, and it is the sharper half of today's lesson:** before replacing a `white/N` value,
establish what the GROUND is. If the container is fixed-dark in both themes — `bg-brand-shell`, a
hardcoded hex, a `bg-black/N` over one of those — then the white-alpha values are right and any
`text-primary`/`text-secondary` inside is the defect. The two fixes are opposite and the class name
does not tell you which you are looking at. Only the ground does.

### Unlit dial ticks invisible on cream

gate-or-promise: promise

Same family as the kit, in an SVG stroke rather than a background, which is why every `white/N`
grep today missed it: `stroke-white/15` is not `bg-white/15`. The sweeps were written for `border|bg|text`.

**The promise:** the property list for this class is `border | bg | text | stroke | fill | divide |
ring | from | to | via`. A sweep that checks three of nine reports a clean file.

### A count-up clamped at one end

gate-or-promise: declined

No gate. A lint rule for "clamped above but not below" would fire on every legitimate one-sided
clamp in the codebase, and `Math.min(1, x)` is correct far more often than not.

Recorded instead because the interesting part is not the bug, it is **what the bug looked like**:
`-6750` next to a correctly-drawn 74% arc, in both themes, reproducible, present in the DOM. Every
signal said real. The thing that settled it was arithmetic on the easing function — `74 × (1 -
(1-p)³) = -6750` solves to `p ≈ -3.5`, which is `t - start ≈ -3.2s`, which is a jsdom time-origin
offset and not anything a browser can do.

**Read the producer, not the render.** Fifth time today, and the first time the producer was a
formula rather than a file.

### The harness photographing states it was not aimed at

gate-or-promise: gate

Three real gates, all of which proved themselves immediately:

- `scrollTo`/`scrollIntoView` stubs — without them any chat/log/transcript surface throws through
  React's commit phase and reads as a product crash.
- `matchMedia` answered per query — jsdom never advances rAF, so without reduced motion every
  animated surface is photographed at frame zero. The Progress gauge was being shot with the arc at
  74% and the number reading 0.
- `macroHome` waits on the loaded body — the previous wait was satisfied by the header, so the
  screen the capture is NAMED for had never been photographed.

That last one is the seventh variant of the same shape today: **a wait condition satisfied by the
state you are not trying to capture.** It has now appeared in a test assertion, in a capture
matcher, and in a matcher that matched the empty-state sentence. The tell is constant: the wait
token is something that renders in BOTH the state you want and the state you don't.
