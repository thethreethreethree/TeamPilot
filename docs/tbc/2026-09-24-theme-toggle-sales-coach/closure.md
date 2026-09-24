# CLOSURE — a theme system a whole module could not reach

## What is true now

Every Sales Coach screen has a light/dark control in its top right, because every Sales Coach
screen renders `TopBar` and that is where the control now lives.

It is the app's own `ThemeToggle` on the app's own `ThemeProvider` — so the choice persists in
localStorage, survives a reload without a flash, and follows the user to another device through
`/api/me/theme`. None of that is new. None of it was reachable from inside Sales Coach.

## The shape of this one

A complete, tested, cross-device theme system, and a whole module that could not reach it. That is
A31 in miniature — *"a settings page with no nav entry. Unreachable."* — and it is the second time
today the same shape has come up. The first was `pitch_scores`: engine, writer, schema and page all
correct, and nothing to call them.

Different scale, identical question: **not "does this exist?" but "can anyone get to it?"**

## Residual

```json
[
  {
    "id": "R1-light-mode-icon-never-rendered",
    "item": "The capture stubs matchMedia to { matches: false }, so the provider resolved dark in BOTH screenshots. The light shot is the dark-resolved DOM re-themed by the wrapper attribute, so the sun icon was never on screen.",
    "why_skipped": "A second capture with the resolution flipped; not run.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T05:05:00Z",
    "outcome": "OPEN and small. ThemeToggle's icon-for-resolved-mode behaviour is shared with three other mount points and is not touched here. What the light capture DOES establish is the part this build changed — the control renders legibly on a cream ground rather than vanishing into it, which was risk 5 in think.md."
  },
  {
    "id": "R2-what-else-does-this-shell-omit",
    "item": "SalesCoachShell was checked for ONE missing app-wide affordance. Whether it omits others relative to the ELOSTATE Sidebar is unknown.",
    "why_skipped": "Enumerating what counts as app-wide chrome and diffing two shells is its own build.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T05:05:00Z",
    "outcome": "OPEN, and it is the question the founder's report implies rather than states. They noticed the theme control was missing because they went looking for it. Anything else missing from that shell has the same property — invisible until somebody reaches for it — and A21 says a broken mental model across modules is a CATEGORY of confusion, not an instance."
  },
  {
    "id": "R3-no-real-browser-session",
    "item": "The cross-device persistence path (/api/me/theme) is exercised by neither the screenshots nor the tests.",
    "why_skipped": "Existing, separately-tested behaviour that this build reuses rather than changes.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T05:05:00Z",
    "outcome": "OPEN and genuinely low. This build adds a mount; it adds no persistence code."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
The two TopBar screenshots were generated into the scratchpad from this project's own components
and both were opened and described before any claim was made about them.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs
in that folder, and every surface in this project running against a real database in a real browser.
