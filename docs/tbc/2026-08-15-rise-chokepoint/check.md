# CHECK - rise-chokepoint

Audited the rendered page after the restructure, not the diff.

**Inspected:** `Rise.tsx`, `WowSections.tsx`, `WowDifferentiator.tsx` and its stylesheet, the rendered
page at 900×4300, and the server-rendered HTML.

**NOT inspected — the load-bearing half:** the hero's four remaining bespoke motion configs beyond
counting them; pointer and keyboard paths on the modules grid; reduced-motion; viewports below 760px;
Safari, Firefox and every engine that is not headless Chromium. No clean bill of health for any.

---

### F1 — the wrapper silently changed the positioning context, and the type checker could not see it

file+location: `WowDifferentiator.tsx`, the `.frame` element

evidence: `Rise` renders its own `div`, so wrapping `.frame` in it moved both `--pos` and the
absolutely-positioned `.before` / `.after` layers up one level in the element tree. `npx tsc --noEmit`
returned **exit 0** across the whole change — the component tree was still semantically valid — while
the section's layout would have been broken on screen.

class: **a refactor that preserves the COMPONENT tree while changing the ELEMENT tree**, where
descendants depend on an ancestor for positioning context or custom-property inheritance. Invisible to
typecheck by construction, because nothing about the types encodes "this element must remain the
positioned ancestor".

sweep: `grep -n "position: absolute" src/components/landing/wow/*.css` — three sites. The other two
(`.divider`, `.range`) are children of the same frame and resolve correctly against the new inner
layer, verified by the capture rather than assumed. No other component in the directory was wrapped.

severity: medium — caught before verification, but it would have shipped a broken section had the
capture been skipped on the strength of an exit-0 typecheck. Which is exactly the substitution A38
names: a true statement about a smaller thing, delivered in the register of a larger one.

---

**Cross-module pass.** The concept that lived under one name in three files was **"entrance
animation."** After this build there is one implementation, `Rise`, and the differentiator holds zero
bespoke motion. The hero retains four hand-written configs — examined in closure's residual rather
than swept under the claim of full coverage.

**Empty-findings check.** `Rise` itself returned clean, and the basis is stated rather than implied:
its type signature accepts `y`, `x`, `delay`, `className`, `children` and nothing else, so the
fail-closed entrance has no expressible form through it. That was verified by reading the signature,
not by testing behaviour — a distinction worth keeping, because it means the guarantee holds for
authors *using* Rise and says nothing about an author who bypasses it.
