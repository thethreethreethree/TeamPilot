# CLOSURE — the light mode shipped this morning had invisible switches

## What is true now

On the two Sales Coach screens that were rendered, light mode shows its controls: the pager has two
dots, the Macro Mode switch has a track you can read a state from, and the home's cards have
borders.

And the project has a tool that renders its own components at a declared width, in both themes, and
produces images for a person to look at.

## The sequence, because it is the point

This morning `ThemeToggle` reached the Sales Coach header — a two-line change to close a gap where
an entire module could not reach a complete, tested, cross-device theme system.

That change did not create a single one of these defects. It made them **reachable**, and then
rendering made them **visible**, and three hours later three invisible controls are fixed.

Shipping the toggle exposed a latent class. That is what shipping a real capability does, and it is
a better outcome than the module staying dark-only so nobody could find out.

## What the tool is actually for

Not screenshot diffing. There are no baselines, nothing fails, and it is deliberately outside
`npm run check`.

It exists because a test can assert every string on a screen while the layout is wrong, the colours
are wrong, or the header sits under the list. Today it found: a tab that rendered nothing
(`rejected_bonus`), a dot that vanished on cream, a switch with no track, and a page whose
structure dissolved — and **one false alarm that was its own wrapper**, which is the accuracy to
expect and the reason `width` is now mandatory.

## Residual

```json
[
  {
    "id": "R1-253-unverified-white-alpha-sites",
    "item": "256 `white/N` uses across 47 files. Three confirmed by render and fixed; the rest unexamined.",
    "why_skipped": "Only a rendered screen distinguishes 'correct on a fixed-dark console' from 'invisible on a theme-following card'. Grep cannot.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T06:00:00Z",
    "outcome": "OPEN, and the sharpest cluster is named: the schedule module has 54 uses across six pages with no reason to be fixed-dark, and not one of them has been rendered. Several other top files ARE intentionally dark and two are already on theme-audit's allowlist for that reason, so the number is a suspect list, not a defect count."
  },
  {
    "id": "R2-the-gate-for-this-class-is-declined-not-missing",
    "item": "theme-audit.mjs has no `white/N` category. The extension is straightforward and was measured at 256 violations / ~47 allowlist entries.",
    "why_skipped": "A gate that ships with 47 author-written exemptions is a check the author routed around (A30).",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T06:00:00Z",
    "outcome": "OPEN BY DECISION, with the order stated: render first, then gate, so the allowlist records things somebody looked at. Recording it here so the next person finds a decision rather than an oversight."
  },
  {
    "id": "R3-eleven-sales-coach-screens-unrendered",
    "item": "Two screens of the module were captured. Door Log, Today's Metrics, Pitch Performance, Roleplay, One Liners, Sessions, Analytics, Coach Assessment, Settings and the Pattern Interrupt screens were not.",
    "why_skipped": "Each needs a capture file with its own fetch fixtures.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T06:00:00Z",
    "outcome": "OPEN AND IT IS THE REQUESTED WORK. The founder chose 'render every Sales Coach screen and look'. Two screens produced three real defects, so the expected yield on the other eleven is not zero."
  },
  {
    "id": "R4-jsdom-is-not-a-browser-session",
    "item": "Captures are jsdom renders with mocked fetches, screenshotted headless. No real click, no real server, no real account.",
    "why_skipped": "An end-to-end session needs auth and seeded data.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T06:00:00Z",
    "outcome": "OPEN. What this catches is appearance, which is exactly the gap it was built for. It says nothing about whether a control WORKS — the Macro toggle looked fine in dark all along while its write reported success without landing."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed. Six
screenshots were generated from this project's own components into `artifacts/visual/` (git-ignored)
and every one was opened and described before any claim was made about it.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs
in that folder, and eleven of the thirteen Sales Coach screens.
