# CLOSURE - landing-sections

## 1. Session-read manifest
12 entries, carried from `2026-08-15-landing-wow-hero` with the per-range hash verification named in
think.md. Minimum set complete.

## 2. Build inventory
| Feature | write-path | read-path |
|---|---|---|
| Seven sections | ✅ rendered by `/landing-wow` in the brief's order | ✅ 826KB full-page capture, all legible |
| Per-section motion | ✅ authored per section | ✅ visible in capture |
| svh fallback | ✅ line added before the svh line | ✅ `grep` shows both, in order |

## 3. Verification record
`npx tsc --noEmit` → **exit 0**. `/landing-wow` → **HTTP 200**. Full-page capture 826,089 bytes at
1400×5200. SSR grep returned `>30<` `>3<` `>0<`.
**Coverage: typecheck 1-of-1, route 1-of-1, SSR values 3-of-3, capture 1-of-1. NOT run: lint, tests,
full `check`. UNTESTED: pointer/keyboard on Modules, reduced-motion, sub-760px, non-Chromium.**

## 4. Findings ledger
| ID | Severity | Disposition | Class boundary swept |
|---|---|---|---|
| F1 honesty stats rendered inverted | high | FIXED (chokepoint) | `grep useState(0)` in `wow/` → 1 instance, fixed |
| F2 svh drops the declaration | medium | FIXED | `grep svh\|dvh\|lvh` in `wow/*.css` → 1 instance, guarded |

## 5. Gates added
**One real gate, by construction.** F1's fix makes the true value the component's default state, so
the defect cannot recur without someone passing a deliberately wrong number — the invariant holds by
construction rather than by detection (A33's preferred form). F2 declined a gate honestly: no
mechanism here can track per-engine CSS unit support, and a check that goes stale as browsers move
is worse than none.

## 6. Residual queue

```json
[
  {
    "id": "R-2026-08-15-10",
    "item": "Two implementations of one entrance idea — Rise in WowSections, bespoke motion calls in WowHero and WowDifferentiator.",
    "why_skipped": "They agree today (both transform-only), so it reads as a tidiness concern rather than a defect.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-14T22:10:00Z",
    "outcome": "OPENED, and the confidence was misplaced. This is precisely where the fail-closed class re-entered last time: the hero's bespoke calls were written before the rule was learned, and WowSections was written after it, which is the only reason they agree. Nothing structural keeps the third author aligned. Confirmed by grep that WowHero.tsx still carries four hand-written motion configs that a future edit could regress independently of Rise. Not fixed here — the fix is to make Rise the only entrance primitive and refactor the hero and differentiator onto it, which is a change to components already checked and belongs in its own build. Re-ranked from 'tidiness' to the durable fix for the class, and it is now the top item for the next landing build."
  },
  {
    "id": "R-2026-08-15-11",
    "item": "Modules hover/dim and card focus have never been operated by a real pointer or keyboard.",
    "why_skipped": "Static capture proves the resting state renders; it cannot exercise :hover or :focus-visible.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  },
  {
    "id": "R-2026-08-15-12",
    "item": "The Problem section's drift animation may read as accidental misalignment rather than as deliberate fragmentation.",
    "why_skipped": "It is a judgement about feel that a screenshot cannot settle — it needs a human scrolling it.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  },
  {
    "id": "R-2026-08-15-13",
    "item": "Nothing here is on the live homepage; the preview and the shipped page are now two different designs.",
    "why_skipped": "Deliberate — the founder scoped this to preview-only and has not reviewed it.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": null
  }
]
```

## 7. Hypothesis outcomes
H1 CONFIRMED (counters rendered inverted; fixed at the chokepoint) · H2 CONFIRMED (svh drops the
declaration; fallback added). Both resolved; neither moved to residual.

## 8. Doc hashes
`CLAUDE.md` `3325eedc1e905b27…` (480 lines) · `ThinkerThinker.md` `19d6ff103082c1f2…` (1068 lines).

---

## The un-named reliance (A35)

**What this build leaned on and never cited: §3.4, "No Instant Results — Honesty Is the Moat."**

I did not consult it while building. It is the clause the whole Proof section exists to express, and
F1 was a *direct violation of it* — the page asserted three numbers that were the opposite of our
actual guarantees, on the one surface whose entire purpose is to be trustworthy. I found that by
looking at a screenshot, not by reasoning from the clause.

**It is in the manifest now, and only because the gate made it so.** Writing this confession cited
§3.4, `tbc:manifest` then refused the build until §3.4 had a real `read_at`, and I opened it. The
read immediately paid: §3.4 specifies month one as a *control condition that must not feel like
surveillance*, and states plainly that *learning does not stop at 30 days* — so the hero's "month
one, we say nothing" is right, but framing 30 days as the whole story undersells the product. That
correction exists because a mechanical check would not let me admit a gap without closing it.

Had I opened §3.4 while writing a section titled *"No testimonials yet. We'd rather say so"*, the
question "what do these numbers say if the animation never runs?" would have been the obvious first
one to ask. The clause governing the surface was one file away and I built the surface without it —
the same shape as the hero build's `Reveal.tsx` finding, two builds running.
