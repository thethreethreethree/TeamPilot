# CHECK — landing-wow-hero

Audited the rendered artifact, not the intent — every finding below was observed in a browser or a
DOM dump, not inferred from the source.

**Inspected:** `WowHero.tsx`, `WowHero.module.css`, `WowDifferentiator.tsx`,
`WowDifferentiator.module.css`, `src/app/landing-wow/page.tsx`, the rendered DOM at `/landing-wow`,
and three screenshot captures. Also read for context: `src/components/landing/Reveal.tsx`,
`LandingPage.tsx`, `Hero.tsx`, `brand.ts`.

**NOT inspected — the load-bearing half:** the seven existing landing sections (`Problem`, `Turn`,
`HowItWorks`, `Modules`, `Proof`, `Close`, `Footer`) beyond counting their `Reveal` usage; `Bulb.tsx`;
mobile viewports below 720px; any real browser other than headless Chromium; Safari and Firefox
entirely. No clean bill of health is claimed for any of them.

---

### F1 — entrance animations that fail CLOSED: content invisible whenever the animation has not run

file+location: `WowHero.module.css` (masked headline, as first written); `WowHero.tsx:87,92,100`
  (sub / CTA row / tagline, as first written); `WowDifferentiator.tsx:30,48` (head + frame)
evidence: rendered black twice. The DOM dump showed every string present with framer-motion's
  initial styles un-cleared — `style="opacity:0;transform:translateY(22px)"` — and the first headline
  used an `@property --r` radial mask animating from `0%`, so an unrun animation left the mask radius
  at zero and the text fully clipped.
class: **a reveal whose resting state is invisible** — content whose visibility is contingent on
  JS having run, rather than on JS having *hidden* it. Fails closed on: pre-hydration paint, JS
  disabled or errored, a slow client, reduced-motion edge cases, and any headless capture.
sweep: `grep -n "opacity: 0" src/components/landing/wow/*.tsx` across every component in the
  directory — 4 further instances found in `WowHero.tsx` beyond the one being fixed (lamp, halo,
  scroll cue, and the `Filament` mark's `pathLength: 0`). All converted to transform-only or to a
  visible resting opacity. Re-ran the same grep: **0 remaining**.
severity: high — it is not a polish defect; the page was blank.
- **the lesson was already in this repo.** `Reveal.tsx`'s own header states the correct rule: *"the
  content ships visible; JS only 'arms' the hidden-then-reveal behavior when it's actually running."*
  It was written down, and I broke it three times anyway — which is A30's thesis with fresh evidence:
  a rule recorded only in a comment does not bind the next author.

### F2 — `node --check` reported a file fine while it carried an unbound identifier

file+location: `scripts/tbc/verify-revision.mjs` in the sibling voice-agent repo, during the
  same session; recorded here because the lesson governs this build's verification claims.
evidence: an import was removed while two call sites still referenced it. `node --check` exited
  0 — it validates syntax, not binding — and I had already written "SYNTAX OK".
class: a static check reported in the register of an operational one — A38's exact shape, and
  §1.5.1's sieve failing at layer 2 while layer 1 was clean.
sweep: `grep -rn "node --check" .` — no other site treats it as a correctness claim. Every
  subsequent verification in this build **executed** the thing (tsc, curl, headless render).
severity: medium

### F3 — the AFTER layer was clipped at `--pos` while still laying out from the frame's left edge

file+location: `WowDifferentiator.module.css` `.after`
evidence: at `--pos: 38%` the diagnosis wrapped such that a line began left of the divider and
  was shaved mid-word — *"…hired in the last 60 days"* rendered as *"0 days"*, visible in the
  1400×2300 capture.
class: a clip boundary applied to a layer whose content flows from outside that boundary —
  clip and layout origin disagreeing.
sweep: `grep -n "clip-path" src/components/landing/wow/*.css` — one instance. Fixed by padding
  the layer past the handle (`padding-left: calc(var(--pos) + 46px)`) so content can never be clipped
  mid-word at any handle position.
severity: medium — it rendered a broken sentence on the section the brief called highest priority.

---

**Cross-module pass.** The concept living under one name in two places is **"reveal on scroll."**
`Reveal.tsx` (used 42× by the shipped sections) and the framer-motion entrances in `landing/wow/`
answer the same question and answered it **oppositely**: `Reveal` ships content visible and arms the
hide only when JS runs; my components hid content and relied on JS to un-hide it. That is the same
class F1 names, at the composition altitude — two implementations of one idea with inverted failure
modes. Resolved in the new components; **the existing 42 uses were not touched** and remain correct.

**Empty-findings check.** One area returned clean under inspection and is stated rather than claimed:
the brand tokens in both new stylesheets were compared against `brand.ts` value-by-value
(`#141414`, `#FFDA03`, `#F7F7F5`) and match. Reduced-motion paths exist in both components but were
**not exercised** — that is an untested assertion, filed to the residual, not a clean finding.
