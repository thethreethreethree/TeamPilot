# CLOSURE — the line was never drawn

## What is true now

`/scoreboard` renders correctly in both themes. All five point bands carry a chip. The rep's
progress sparkline draws a line.

## The one worth keeping

`MyProgress`'s docstring says what it is for: *"Restrained dataviz: one accent line, a faint
zero-to-100 frame, an emphasized last point — no gradients/legends/gridlines."*

It drew the frame. It never drew the line. The accent line was `className="stroke-primary"`, and
`primary` is defined in `tailwind.config.ts` under **`textColor` only** — so `stroke-primary`
matches no utility, Tailwind emits nothing for it, and the element falls back to SVG's own
defaults: no stroke at all. The "emphasized last point" was `fill-primary`, which failed the same
way and left the browser's default `fill: black` — black in dark mode too, where nothing else on
the page is black.

**It type-checks. It lints. It passes the twelve-step gate. It reads correctly to anyone who knows
the design system.** A class name that matches no rule is not an error anywhere in this toolchain;
it is a string in a `className` that survives into the DOM looking applied.

This is a different animal from everything else found today. Every other defect was a value that
was correct on one ground and wrong on the other — visible in a comparison. This one was wrong on
every ground since the day it was written, and only looking at the picture could find it, because
the failure produces *absence*, and absence is what an unrendered surface looks like too.

## And the fourth "one branch away"

`Scoreboard.tsx:60-66` maps five bands to chips. Four carry `-700 dark:-300`. The middle one
carries `bg-white/10`.

That is the fourth time today: the Analytics grade ternary, `PitchBreakdown`'s two guarded fields
beside its unguarded one, `TodaysMetrics`'s `data?.scores?.[d]` two lines above `data?.kpi.`, and
this. **When a literal holds several members of one decision, they are each other's evidence** —
if three are mode-split and one is not, the odd one is a defect rather than a choice. Four
instances is enough to stop calling it a coincidence.

## Residual

```json
[
  {
    "id": "R1-the-config-change-was-verified-by-argument",
    "item": "The `stroke`/`fill` token sections are a global Tailwind change, verified by an exhaustive sweep showing the new utilities are used in exactly one file, rather than by re-shooting all 40 captures.",
    "why_skipped": "The edit is purely additive — it creates utilities that did not exist — so only files using them can render differently.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T10:04:06Z",
    "outcome": "OPEN and small. The argument is written out in check.md so it can be checked; it is only as good as the sweep, and the sweep covers every glob in Tailwind's own `content` config."
  },
  {
    "id": "R2-other-token-property-mismatches-are-unswept",
    "item": "`text-primary` existing does not mean `border-primary`, `ring-primary`, `divide-primary`, `outline-primary` or `accent-primary` exist. Only `stroke-` and `fill-` were swept.",
    "why_skipped": "The two that were reachable in this build are fixed; the rest needs a resolver-level check.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T10:04:06Z",
    "outcome": "OPEN. The failure is silent by construction, so the count is unknown rather than zero. The cheap human tell is an element rendering in the BROWSER's defaults — black fill, no stroke, a 1px solid border — where the theme has no such value."
  },
  {
    "id": "R3-seven-routes-still-unrendered",
    "item": "/settings (1060 lines, 9 sites), /[id] (1159, 5), /kpi (909, 5), /training (379, 6), /team (376, 3), /calibration, /team-chat, /door.",
    "why_skipped": "One at a time.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T10:04:06Z",
    "outcome": "OPEN. /settings and /[id] are next by size."
  },
  {
    "id": "R4-the-pitch-score-board-was-rendered-but-not-interrogated",
    "item": "PitchLeaderboard has zero white-alpha sites and rendered correctly, so it was read as clean without its period switcher, its capped state or its empty state being exercised.",
    "why_skipped": "No member of any known class appears in it.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T10:04:06Z",
    "outcome": "OPEN, and named because 'no member of a known class' is exactly the reasoning that declared strategy/page.tsx clean this morning — and it was a member by inheritance. A clean grep is not a clean screen."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Two captures plus six crops were generated from this project's own components into
`artifacts/visual/` (git-ignored), and each was opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, seven Sales Coach routes, and the `RepActivity` sub-view.
