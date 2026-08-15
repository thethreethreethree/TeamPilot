# REMEDIATE - landing-sections

### F1 — honesty statistics rendering as their own opposite

closes: F1
disposition: FIXED
what changed: `Count` now initialises to the **true** value (`useState(to)`), so the server-rendered
HTML and the no-JS state both carry the real number. The drop to zero happens inside `useEffect` —
which only runs on the client, after React has proven it is alive — immediately before the observer
arms the count-up. The animation is unchanged for anyone who sees it.
clause: §3.4, §1.5.1 layer 2, A30
gate-or-promise: GATE — and it is a chokepoint rather than a detector. The truthful value is now the
**default state of the component**, so producing the defect again would require someone to
deliberately pass a wrong `to`. That is A33's preferred shape: make the invariant hold by
construction instead of writing a check that pattern-matches for it. Verified by command rather than
by reading: `curl -s http://localhost:4321/landing-wow | grep -oE ">30<|>3<|>0<"` returns all three
literal values from the SSR output, before any JavaScript executes.
risk introduced: a client that hydrates will briefly show the true number before it resets to zero and
counts up — a visible flash on fast connections. That is the correct trade: a momentary flash of the
right answer beats a stable display of the wrong one.

### F2 — min(100svh, …) discarding the declaration

closes: F2
disposition: FIXED
what changed: `min-height: min(100vh, 1080px)` inserted immediately before the `svh` line. An engine
without `svh` takes the first; an engine with it overrides on the second.
clause: §1.5.3, §1.5.1 layer 2
gate-or-promise: PROMISE, and the hole is named. A gate would have to know which CSS units each
target engine supports, which this repo has no mechanism for and which would go stale as browsers
move. Declining rather than shipping a check that cannot be kept true. The mitigation is that the
pattern is now visible in the file as two adjacent lines, so the next author editing the hero height
sees the fallback convention rather than inventing one.
risk introduced: none — the fallback is strictly additive.

---

## Re-verification

```
$ npx tsc --noEmit
TSC EXIT=0

$ curl -s http://localhost:4321/landing-wow | grep -oE ">30<|>3<|>0<"
>30<
>3<
>0<

$ grep -n "min-height" src/components/landing/wow/WowHero.module.css
11:  min-height: min(100vh, 1080px);
12:  min-height: min(100svh, 1080px);

$ grep -n "opacity: 0" src/components/landing/wow/WowSections.tsx
(no matches — the fail-closed class was not reintroduced)
```

**coverage:** typecheck 1-of-1 exit 0; SSR values confirmed 3-of-3; fallback confirmed present;
fail-closed sweep clear. **untested:** pointer/keyboard on the Modules grid, reduced-motion,
sub-760px, non-Chromium engines.
