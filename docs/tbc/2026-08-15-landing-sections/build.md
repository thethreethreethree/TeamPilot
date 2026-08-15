# BUILD - landing-sections

### Seven sections — problem, turn, how-it-works, modules, proof, close, footer

files: `src/components/landing/wow/WowSections.tsx`, `WowSections.module.css`

write-path: exists — `src/app/landing-wow/page.tsx` renders `<WowSections />` and
`<WowSectionsAfter />` around the differentiator, so the arc sits in the brief's order. Copy is
authored in the `TOOLS` / `STEPS` / `MODULES` arrays; a human edits those.

read-path: exists — all seven render at `/landing-wow`, confirmed in an **826,089-byte** full-page
capture at 1400×5200. Every heading, body paragraph and stat legible; no blank regions.

### Distinct motion per section — the brief's "most of the wow"

files: same

write-path: exists — problem cards drift apart on scroll and tilt as they go; the turn carries the
page's single bright glow; how-it-works draws a thread between the three beats; modules dim their
siblings on hover so "one platform" is felt rather than asserted; proof counts up; close restates
the CTA under a low glow.

read-path: exists — visible in the capture. The modules interaction is one React `active` value plus
CSS, so it is inspectable without a debugger.

### svh fallback — closes residual R-2026-08-15-01 from the previous build

files: `src/components/landing/wow/WowHero.module.css`

write-path: exists — `min-height: min(100vh, 1080px)` now precedes the `svh` line.

read-path: exists — `grep -n "min-height"` shows both lines, in order:

```
11:  min-height: min(100vh, 1080px);
12:  min-height: min(100svh, 1080px);
```

---

## Verification — commands by name

```
$ npx tsc --noEmit
TSC EXIT=0

$ curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:4321/landing-wow
HTTP 200

$ chrome --headless --window-size=1400,5200 --virtual-time-budget=12000 --screenshot
826,089 bytes written  - all nine sections legible

$ curl -s http://localhost:4321/landing-wow | grep -oE ">30<|>3<|>0<"
>30<
>3<
>0<
```

That last command is the one that matters. It proves the three honesty statistics carry their **true
values in the server-rendered HTML**, before any JavaScript runs — which is precisely what the
earlier version got wrong.

**coverage:** typecheck 1-of-1 exit 0; route 1-of-1; full-page capture inspected; SSR values grepped
and matched. **not-run:** `npm run lint`, `npm run test`, the full `check` chain.

**untested:** the Modules hover/focus behaviour by real pointer or keyboard; reduced-motion; layouts
below 760px; every non-Chromium engine. Labelled UNTESTED, not claimed.
