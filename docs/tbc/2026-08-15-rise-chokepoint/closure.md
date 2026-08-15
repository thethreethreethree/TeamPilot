# CLOSURE - rise-chokepoint

## 1. Session-read manifest
9 entries, minimum set complete, carried with the per-range hash verification named in think.md.

## 2. Build inventory
| Feature | write-path | read-path |
|---|---|---|
| `Rise` primitive | authored; no opacity prop by design | imported by 2 components, page renders |
| Refactor onto it | 3 files changed | differentiator re-captured, intact |
| `.frameInner` fix | one CSS rule | `--pos:34%` present in SSR |

## 3. Verification record
`npx tsc --noEmit` → **exit 0** · `/landing-wow` → **HTTP 200** · 598,906-byte capture at 900×4300
inspected · SSR stats re-grepped `>30< >3< >0<` · bespoke motion in differentiator: **0**.
**Coverage 5-of-5 executed. NOT run: lint, tests, full `check`. UNTESTED: pointer, keyboard,
reduced-motion, sub-760px, non-Chromium.**

## 4. Findings ledger
| ID | Severity | Disposition | Boundary swept |
|---|---|---|---|
| F1 wrapper moved the positioning context | medium | FIXED | `grep position: absolute` in `wow/*.css` — 3 sites, all checked |

## 5. Gates added

**One, and it is the entire point of this build.** `Rise` has no opacity prop, so a fail-closed
entrance is now **unexpressible** through the only entrance primitive on the page. This is A33's
preferred form — the invariant holds by construction rather than by a detector that would fire on
correct code and be learned around.

It is the **first real gate this class has had** after four instances fixed in prose across two builds.

**Honest limit, stated so the gate is not mistaken for coverage:** it binds only code that *uses*
`Rise`. Someone can still hand-write a `motion.div` with `opacity: 0`. What changed is that the easy
path is now the safe one and the unsafe path requires deliberately bypassing the primitive. That is a
real improvement and it is not the same as impossibility.

## 6. Residual queue

```json
[
  {
    "id": "R-2026-08-15-20",
    "item": "The hero still holds four hand-written motion configs — lamp scale, halo, scroll cue, filament path-draw — which Rise does not cover.",
    "why_skipped": "None of them is an entrance, so the primitive does not apply and converting them would be scope creep.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-14T23:05:00Z",
    "outcome": "OPENED, and the reasoning mostly holds but ONE correction matters. Three of the four are genuinely not entrances and have no fail-closed variant available. But the filament path-draw DOES: it was `pathLength: 0` in the first hero version, which drew no logo at all, and had to be corrected to 0.001. So the class CAN reach hero motion that Rise does not cover, and the chokepoint's boundary therefore excludes SVG draw animations. Not re-fixed — that code is already correct — but recorded so nobody reads 'chokepoint installed' as 'class closed everywhere'. This is exactly why A36 says to open the entry you are most sure about."
  },
  {
    "id": "R-2026-08-15-21",
    "item": "Nothing from any of these three builds is on the live homepage; the preview and the shipped page are now two different designs.",
    "why_skipped": "Deliberate — the founder scoped preview-only and has not yet reviewed it.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": null
  },
  {
    "id": "R-2026-08-15-22",
    "item": "Rise's guarantee was verified by reading its type signature, never by testing that a fail-closed entrance actually cannot be written through it.",
    "why_skipped": "The guarantee is structural — there is no prop to pass — so a test would assert the absence of an API rather than a behaviour.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  }
]
```

## 7. Hypothesis outcomes
H1 CONFIRMED — the wrapper moved the positioning context exactly as predicted; fixed before
verification rather than found afterwards.

## 8. Doc hashes
`CLAUDE.md` `3325eedc1e905b27…` (480 lines) · `ThinkerThinker.md` `19d6ff103082c1f2…` (1068 lines).

---

## The un-named reliance (A35)

**This build leaned on `Reveal.tsx` and never cited it — for the third build running.**

`Reveal` is the component that had the rule right the entire time: *"the content ships visible; JS only
arms the hidden-then-reveal behavior when it's actually running."* This build is, honestly described,
that same discipline re-expressed as an **API constraint instead of a comment**.

The difference between them is the whole of A30. `Reveal` *asks* the author to ship content visible.
`Rise` makes shipping it invisible **impossible through the primitive**. One is prose; the other is a
gate. It took four instances across two builds to act on a rule that was already written down, in the
same directory, by the same codebase — and the only reason it got acted on at all is that A36's
ranking rule forced me to open a residual I had filed as "just tidiness".
