# CHECK - landing-sections

Audited the rendered page and the server-rendered HTML, not the component source.

**Inspected:** `WowSections.tsx`, `WowSections.module.css`, `src/app/landing-wow/page.tsx`,
`WowHero.module.css` (the svh line), the full-page capture at 1400×5200, and the raw SSR HTML.

**NOT inspected — the load-bearing half:** the Modules hover/focus path under a real pointer or
keyboard; reduced-motion behaviour; any viewport below 760px; Safari, Firefox, and every engine that
is not headless Chromium; the seven *shipped* sections this preview would eventually replace. No
clean bill of health is claimed for any of them.

---

### F1 — the honesty statistics rendered as their own opposite

file+location: `WowSections.tsx`, the `Count` component's initial state

evidence: the full-page capture showed the Proof section reading **"0 days"**, **"0 signals"**,
**"0"**. Those three numbers are the page's claims about our honesty guarantees, so the rendered
sentence was *"0 days of silence before the AI gives a single piece of guidance"* and *"0 signals
minimum before a problem may reach a human"* — the precise inverse of what the product does.

class: **a value whose resting state is its own opposite.** Sibling of the hero build's F1
(fail-closed visibility) at the *value* altitude rather than the *visibility* altitude. There, an
unrun animation hid the truth; here it **asserted the reverse of it**, which is strictly worse — a
blank space is obviously broken, a confident wrong number is not.

sweep: `grep -n "useState(0)\|useState(reduce ? .* : 0)" src/components/landing/wow/*.tsx` — one
instance, the `Count` component. No other animated value in the directory starts from a state that
would read as a claim; the transform-only entrances animate position, which has no truth value.

severity: high — this is the §3.4 honesty surface. Of every element on the page, these three numbers
are the ones that must not be wrong.

### F2 — `min(100svh, …)` discards the whole declaration on an engine without svh

file+location: `WowHero.module.css:11`

evidence: an invalid value inside `min()` invalidates the **declaration**, not just the function, so
an engine that does not understand `svh` drops `min-height` entirely and the hero collapses to
content height instead of owning the viewport.

class: a progressive-enhancement unit used without a fallback — the newer syntax is not additive,
it replaces the only declaration present.

sweep: `grep -rn "svh\|dvh\|lvh" src/components/landing/wow/*.css` — one instance, now fallback-guarded.

severity: medium — cosmetic rather than incorrect, but the Apple-keynote framing depends on the hero
filling the screen.

---

**Cross-module pass.** The concept appearing under one name in two places is **"entrance animation."**
`Rise` in `WowSections.tsx` and the bespoke `motion` calls in `WowHero.tsx` / `WowDifferentiator.tsx`
answer the same question. They now agree — both transform-only — but they are **two implementations
of one idea**, and the hero build's F1 is evidence that this exact duplication is where the class
re-enters. Recorded as a residual: the durable answer is one shared primitive, which is why `Rise`
was written as a named component here rather than inlined per section.

**Empty-findings check.** One area returned clean under inspection and is stated rather than claimed:
every entrance in `WowSections.tsx` was checked against the fail-closed rule before the render —
`grep -n "opacity: 0" src/components/landing/wow/WowSections.tsx` returns nothing, and the file was
written after the sweep specifically to not reintroduce it. That check passed on the *first* look,
which per the ground-up-audit rule that an empty flag list is itself suspicious is worth stating: it passed because the rule was applied while writing, not
because the surface was never examined.
