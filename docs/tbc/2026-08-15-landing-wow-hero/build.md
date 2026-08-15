# BUILD — landing-wow-hero

Inventory with reachability assertions per A31. For a marketing surface the two paths are: something
puts the content on the page, and a **human eye** can actually see it — which is the direction this
build failed three times, so each item below cites the screenshot that proves the read path.

---

### WowHero — the one-idea hero

- **files:** `src/components/landing/wow/WowHero.tsx`, `WowHero.module.css`
- **write-path:** exists — `src/app/landing-wow/page.tsx` renders `<WowHero />` inside the `sora`
  font wrapper. Copy is authored in the component; a human edits the two headline strings in the
  array at `WowHero.tsx`.
- **read-path:** exists — served at `/landing-wow`, HTTP 200, and **visually confirmed**: headline,
  subhead, both CTAs, tagline and the lit filament-e all render at 1400×900. Screenshot captured at
  three viewport sizes (1400×900, 1400×1150, 1400×2300).
- **brief compliance:** one idea, one light source, huge type, nothing competing — the
  "Apple-keynote, not enterprise-dashboard" requirement. No dashboard, no panel, no mock UI.

### WowDifferentiator — the scrubbable before/after

The section the brief flagged as highest priority alongside the hero, and its "show, don't tell"
requirement: *"an animated before/after or a visual of the system surfacing WHY something's wrong,
not just THAT it is."*

- **files:** `src/components/landing/wow/WowDifferentiator.tsx`, `WowDifferentiator.module.css`
- **write-path:** exists — a real `<input type="range">` drives `pos` state, which sets the `--pos`
  custom property on the frame; that one value moves the clip, the divider and the handle together.
  Keyboard-operable and screen-reader labelled, so it is not pointer-only.
- **read-path:** exists — both panels render legibly and the divider sits where `--pos` puts it,
  confirmed by screenshot at 1400×2300 after the visibility fix.
- **why it argues rather than claims:** the visitor performs the product's core act — moving from
  "the number went down" to "here is why, with the evidence" — with their own hand.

### Preview route

- **files:** `src/app/landing-wow/page.tsx`
- **write-path:** exists — a Next.js route, `robots: { index: false, follow: false }`.
- **read-path:** exists — `curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/landing-wow`
  → `200`.
- **isolation:** the live landing at `/` and the existing `/landing-preview` are untouched. Nothing
  this build produced is reachable by a visitor or a crawler.

---

## Verification — commands, by name, with exit codes

```
$ npx tsc --noEmit
TSC EXIT=0

$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:4321/landing-wow
HTTP 200
```

Rendering claims are backed by captures, not by reading the source:

```
$ chrome --headless --window-size=1400,900  --screenshot  → 242,403 bytes  hero legible
$ chrome --headless --window-size=1400,1150 --screenshot  → 284,377 bytes
$ chrome --headless --window-size=1400,2300 --screenshot  → 446,420 bytes  both sections legible
```

**coverage:** typecheck 1-of-1 exit 0; route reachability confirmed; three viewport captures
inspected. **not-run:** `npm run lint`, `npm run test`, and the full `npm run check` chain were not
executed for this build — the pre-commit hook runs `tbc:docs` + `tbc:manifest`, and the remaining
gates in `check` are not scoped to a preview-only marketing route. **Stated as coverage, not as a
pass.**

**untested:** drag behaviour of the range input was never exercised by a real pointer — headless
capture proves it *renders*, not that dragging feels right. Keyboard operation likewise unverified.
Labelled UNTESTED rather than claimed. Filed to the residual in closure.md.

## The diagnostic that mattered

The page rendered black twice and I nearly guessed at it a third time. What ended the guessing was
dumping the DOM instead of theorising:

```
$ chrome --headless --dump-dom http://localhost:4321/landing-wow | grep -oE 'style="[^"]*opacity[^"]*"'
style="opacity:0;transform:scale(0.9)"
style="opacity:0"
style="transform:translateY(110%)"
style="opacity:0;transform:translateY(22px)"
```

Every string of copy was present in the DOM. The content was never missing — it was waiting on JS to
become visible. That single command turned three rounds of speculation into one named class, which is
CAT-002's rule applied: make the system report the exact state before hypothesising.
